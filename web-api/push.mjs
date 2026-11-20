import webPush from 'web-push'
import { createECDH } from 'node:crypto'
import { WebApiError } from './java.mjs'
import { transaction } from './payments.mjs'

const subscriptions = 'smashkaro_web.push_subscriptions'
const deliveries = 'smashkaro_web.push_deliveries'
const pushOrigins = new Set(['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'])

function subscription(body) {
  let url
  try { url = new URL(body.endpoint) } catch { throw new WebApiError(400, 'Invalid push subscription') }
  if (url.protocol !== 'https:' || !pushOrigins.has(url.hostname) || url.username || url.password || url.port ||
      url.hash || url.pathname === '/' || url.href.length > 2048) {
    throw new WebApiError(400, 'Unsupported browser push endpoint')
  }
  const { p256dh, auth } = body.keys ?? {}
  if (typeof p256dh !== 'string' || !/^[\w-]{87}$/.test(p256dh) ||
      typeof auth !== 'string' || !/^[\w-]{22}$/.test(auth)) {
    throw new WebApiError(400, 'Invalid push subscription keys')
  }
  try {
    const key = createECDH('prime256v1')
    key.generateKeys()
    key.computeSecret(p256dh, 'base64url')
  } catch { throw new WebApiError(400, 'Invalid push subscription keys') }
  return { endpoint: url.href, keys: { p256dh, auth } }
}

export function pushRoutes(router, pool, config) {
  router.post('/push/subscriptions', async (req, res) => {
    if (!config) throw new WebApiError(503, 'Browser push is unavailable on this server')
    const { endpoint, keys } = subscription(req.body)
    const id = await transaction(pool, async db => {
      // Keep ownership of a browser endpoint scoped to its subscribed account.
      const { rows: [row] } = await db.query(`INSERT INTO ${subscriptions} (endpoint, keys, recipient_id, recipient_role)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (endpoint) DO UPDATE SET keys = EXCLUDED.keys
        WHERE ${subscriptions}.recipient_id = EXCLUDED.recipient_id AND ${subscriptions}.recipient_role = EXCLUDED.recipient_role
        RETURNING id`, [endpoint, keys, req.webUser.id, req.webUser.role])
      if (!row) throw new WebApiError(409, 'Remove the previous browser subscription and try again')
      return row.id
    })
    res.status(201).json({ success: true, data: { subscriptionId: id } })
  })

  router.delete('/push/subscriptions/:subscriptionId', async (req, res) => {
    const id = req.params.subscriptionId
    if (!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(id)) throw new WebApiError(404, 'Subscription not found')
    await pool.query(`DELETE FROM ${subscriptions} WHERE id = $1 AND recipient_id = $2`, [id, req.webUser.id])
    res.status(204).end()
  })
}

export async function deliverPush(pool, vapidDetails, send = webPush.sendNotification) {
  await pool.query(`INSERT INTO ${deliveries} (subscription_id, notification_id)
    SELECT s.id, n.id FROM ${subscriptions} s
    JOIN public.notifications n ON n.recipient_id = s.recipient_id AND n.recipient_role = s.recipient_role
    WHERE NOT n.is_read AND n.created_at >= s.enabled_since AND n.created_at >= now() - interval '1 day'
    ON CONFLICT DO NOTHING`)
  await pool.query(`DELETE FROM ${deliveries} WHERE created_at < now() - interval '2 days'`)
  const { rows } = await pool.query(`SELECT d.subscription_id, d.notification_id FROM ${deliveries} d
    WHERE NOT d.delivered AND d.attempts < 5 AND d.retry_after <= now()
    ORDER BY d.retry_after LIMIT 40`)
  // A database row lock lets rolling deployments run more than one worker.
  for (const delivery of rows) {
    await transaction(pool, async db => {
      const args = [delivery.subscription_id, delivery.notification_id]
      const { rows: [job] } = await db.query(`SELECT d.attempts, s.endpoint, s.keys, s.recipient_role, n.is_read
        FROM ${deliveries} d JOIN ${subscriptions} s ON s.id = d.subscription_id
        JOIN public.notifications n ON n.id = d.notification_id AND n.recipient_id = s.recipient_id AND n.recipient_role = s.recipient_role
        WHERE d.subscription_id = $1 AND d.notification_id = $2 AND NOT d.delivered AND d.attempts < 5
          AND d.retry_after <= now() FOR UPDATE OF d, s SKIP LOCKED`, args)
      if (!job) return
      if (!job.is_read) {
        try {
          // In-app alerts can contain personal details. Keep lock-screen pushes generic.
          await send({ endpoint: job.endpoint, keys: job.keys }, JSON.stringify({ id: delivery.notification_id,
            role: job.recipient_role }), { vapidDetails, TTL: 300, timeout: 4000 })
        } catch (error) {
          if ([404, 410].includes(error.statusCode)) {
            await db.query(`DELETE FROM ${subscriptions} WHERE id = $1`, [delivery.subscription_id])
            return
          }
          await db.query(`UPDATE ${deliveries} SET attempts = attempts + 1,
            retry_after = now() + (30 * power(2, attempts)) * interval '1 second'
            WHERE subscription_id = $1 AND notification_id = $2`, args)
          return
        }
      }
      await db.query(`UPDATE ${deliveries} SET delivered = true WHERE subscription_id = $1 AND notification_id = $2`, args)
    })
  }
}
