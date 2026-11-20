import express from 'express'
import cors from 'cors'
import { authenticate, WebApiError } from './java.mjs'
import { pushRoutes } from './push.mjs'
import { paymentRoutes } from './payments.mjs'
import { tournamentRoutes } from './tournaments.mjs'

export const webPrefix = '/api/web/v1'

export function createApp({ pool, java, origins, push, payment, tournaments, gateway }) {
  const app = express()
  app.disable('x-powered-by')
  const router = express.Router({ caseSensitive: true, strict: true })
  app.use(webPrefix, cors({ origin: origins, methods: ['GET', 'POST', 'PATCH', 'DELETE'] }), router)

  router.use((_req, res, next) => {
    res.set('cache-control', 'no-store')
    next()
  })
  const authenticated = express.Router({ caseSensitive: true, strict: true })
  authenticated.use(express.json({ limit: '16kb' }), authenticate(java))
  const webhook = paymentRoutes(authenticated, pool, payment, gateway)
  router.post('/webhooks/razorpay', express.raw({ type: 'application/json', limit: '256kb', inflate: false }), webhook)
  pushRoutes(authenticated, pool, push)
  tournamentRoutes(authenticated, tournaments)
  router.use(authenticated)

  app.use((_req, res) => res.status(404).json({ success: false, message: 'Web API endpoint not found' }))
  app.use((error, _req, res, _next) => {
    if (error instanceof WebApiError) return res.status(error.status).json({ success: false, message: error.message })
    if ([400, 413, 415].includes(error.status)) return res.status(error.status).json({ success: false, message: 'Invalid web request body' })
    console.error('Web API request failed', error.code ?? error.name)
    return res.status(500).json({ success: false, message: 'Unable to complete the web request' })
  })
  return app
}
