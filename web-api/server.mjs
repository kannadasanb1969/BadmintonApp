import pg from 'pg'
import { createApp } from './app.mjs'
import { javaClient } from './java.mjs'
import { deliverPush } from './push.mjs'

const {
  PORT = 8788, WEB_JAVA_API_ORIGIN, WEB_DATABASE_URL, WEB_ALLOWED_ORIGINS = 'http://localhost:5173',
  WEB_VAPID_SUBJECT, WEB_VAPID_PUBLIC_KEY, WEB_VAPID_PRIVATE_KEY, WEB_TOURNAMENTS,
  WEB_PAYMENT_MODE, WEB_RAZORPAY_KEY_ID, WEB_RAZORPAY_KEY_SECRET, WEB_RAZORPAY_WEBHOOK_SECRET,
} = process.env

if (!WEB_JAVA_API_ORIGIN || !WEB_DATABASE_URL) throw new Error('WEB_JAVA_API_ORIGIN and WEB_DATABASE_URL are required')
const javaOrigin = new URL(WEB_JAVA_API_ORIGIN)
if (javaOrigin.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(javaOrigin.hostname)) {
  throw new Error('The Java staging origin must use HTTPS')
}
const origins = WEB_ALLOWED_ORIGINS.split(',').map(value => new URL(value.trim()).origin)
const vapid = [WEB_VAPID_SUBJECT, WEB_VAPID_PUBLIC_KEY, WEB_VAPID_PRIVATE_KEY]
if (vapid.some(Boolean) && !vapid.every(Boolean)) throw new Error('Set all three WEB_VAPID values')
const push = vapid.every(Boolean) ? { subject: WEB_VAPID_SUBJECT, publicKey: WEB_VAPID_PUBLIC_KEY, privateKey: WEB_VAPID_PRIVATE_KEY } : undefined

let payment
if (WEB_PAYMENT_MODE) {
  if (WEB_PAYMENT_MODE !== 'razorpay-test' || !WEB_RAZORPAY_KEY_ID?.startsWith('rzp_test_') ||
      !WEB_RAZORPAY_KEY_SECRET || !WEB_RAZORPAY_WEBHOOK_SECRET) throw new Error('Configure Razorpay test credentials to enable web checkout')
  payment = { keyId: WEB_RAZORPAY_KEY_ID, secret: WEB_RAZORPAY_KEY_SECRET, webhookSecret: WEB_RAZORPAY_WEBHOOK_SECRET }
}

const pool = new pg.Pool({ connectionString: WEB_DATABASE_URL, connectionTimeoutMillis: 5000, statement_timeout: 12000 })
pool.on('error', () => console.error('Web database connection lost'))
const java = javaClient(javaOrigin)
const app = createApp({ pool, java, origins, push, payment, tournaments: WEB_TOURNAMENTS === '1' })
const server = app.listen(PORT, () => console.log('Smash Karo Web API listening on port', PORT))
let timer, stopping
async function poll() {
  try { await deliverPush(pool, push) }
  catch (error) { console.error('Web Push worker failed', error.code ?? error.name) }
  finally { if (!stopping) timer = setTimeout(poll, 15000) }
}
if (push) void poll()
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => {
  stopping = true
  clearTimeout(timer)
  server.close(() => void pool.end())
})
