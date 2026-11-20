import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { resourceId, WebApiError } from './java.mjs'

const checkouts = 'smashkaro_web.checkouts'
const ordersPath = '/court-bookings/checkouts'
const bookingPath = bookingId => '/api/court-bookings/' + resourceId(bookingId)
const identity = value => typeof value === 'string' && /^[A-Za-z0-9_-]{8,100}$/.test(value)
const gatewayId = (value, prefix) => identity(value) && value.startsWith(prefix)

export async function transaction(pool, operation) {
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    await db.query("SET LOCAL lock_timeout = '5s'")
    const result = await operation(db)
    await db.query('COMMIT')
    return result
  } catch (error) {
    await db.query('ROLLBACK')
    throw error
  } finally {
    db.release()
  }
}

export function verifiedSignature(key, message, signature) {
  if (typeof signature !== 'string' || !/^[a-f\d]{64}$/i.test(signature)) return false
  const expected = createHmac('sha256', key).update(message).digest()
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'))
}

export function razorpay({ keyId, secret }) {
  return async (path, body) => {
    let result
    try {
      const authorization = 'Basic ' + Buffer.from(keyId + ':' + secret).toString('base64')
      const response = await fetch('https://api.razorpay.com/v1' + path, {
        method: body ? 'POST' : 'GET',
        headers: { authorization, 'content-type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        redirect: 'error',
        signal: AbortSignal.timeout(6000),
      })
      if (!response.ok) throw new Error()
      result = await response.json()
    } catch {
      throw new WebApiError(502, 'Razorpay test checkout is temporarily unavailable')
    }
    return result
  }
}

function bookingRequest(input = {}) {
  const { venueId, courtId, bookingDate, startTime, endTime, quotedAmount, paymentOption, idempotencyKey } = input
  if (Boolean(venueId) === Boolean(courtId) || !/^[\w:-]{1,128}$/.test(venueId ?? courtId ?? '') ||
      !/^\d{4}-\d{2}-\d{2}$/.test(bookingDate ?? '') || !/^\d{2}:00$/.test(startTime ?? '') ||
      !/^\d{2}:00$/.test(endTime ?? '') || typeof quotedAmount !== 'string' || !/^\d{1,9}(\.\d{1,2})?$/.test(quotedAmount) ||
      !['FULL_ONLINE', 'ADVANCE_30'].includes(paymentOption) || !identity(idempotencyKey)) {
    throw new WebApiError(400, 'A valid slot, quote and test payment option are required')
  }
  return { ...(venueId ? { venueId } : { courtId }), bookingDate, startTime, endTime, quotedAmount, paymentOption, idempotencyKey }
}

function paise(value) {
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(value)) throw new WebApiError(502, 'Invalid checkout amount')
  const [rupees, fraction = ''] = String(value).split('.')
  return Number(rupees) * 100 + Number(fraction.padEnd(2, '0'))
}

function checkCaptured(payment, row) {
  return payment?.status === 'captured' && payment.order_id === row.gateway_order_id &&
    payment.currency === 'INR' && payment.amount === row.amount && gatewayId(payment.id, 'pay_')
}

export function paymentRoutes(router, pool, config, gateway = config && razorpay(config)) {
  function requirePlayer(req) {
    if (!config) throw new WebApiError(503, 'Web checkout is unavailable on this server')
    if (req.webUser.role !== 'PLAYER') throw new WebApiError(403, 'A player account is required')
  }

  function result(row, booking) {
    return {
      checkoutId: row.id, booking, testMode: true,
      paymentStatus: row.gateway_payment_id ? 'CAPTURED' : 'AWAITING_PAYMENT',
      ...(booking.status === 'PENDING' && !row.gateway_payment_id && row.gateway_order_id ? {
        order: { id: row.gateway_order_id, amount: row.amount, currency: 'INR', keyId: config.keyId },
      } : {}),
    }
  }

  async function ownedCheckout(db, req) {
    requirePlayer(req)
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(req.params.checkoutId)) {
      throw new WebApiError(404, 'Checkout not found')
    }
    const { rows: [row] } = await db.query(
      `SELECT * FROM ${checkouts} WHERE id = $1 AND player_id = $2 FOR UPDATE`, [req.params.checkoutId, req.webUser.id],
    )
    if (!row?.booking_id) throw new WebApiError(404, 'Checkout not found')
    return row
  }

  async function recordPayment(db, row, payment) {
    if (!checkCaptured(payment, row) || (row.gateway_payment_id && row.gateway_payment_id !== payment.id)) {
      throw new WebApiError(409, 'Razorpay has not captured the expected test payment')
    }
    await db.query(`UPDATE ${checkouts} SET gateway_payment_id = $2 WHERE id = $1`, [row.id, payment.id])
    return { ...row, gateway_payment_id: payment.id }
  }

  router.post(ordersPath, async (req, res) => {
    requirePlayer(req)
    const input = bookingRequest(req.body)
    const { idempotencyKey } = input
    await pool.query(`INSERT INTO ${checkouts} (player_id, idempotency_key, request) VALUES ($1, $2, $3)
      ON CONFLICT (player_id, idempotency_key) DO NOTHING`, [req.webUser.id, idempotencyKey, input])
    const checkout = await transaction(pool, async db => {
      const { rows: [row] } = await db.query(
        `SELECT *, request = $3::jsonb AS same_request FROM ${checkouts}
         WHERE player_id = $1 AND idempotency_key = $2 FOR UPDATE`, [req.webUser.id, idempotencyKey, input],
      )
      if (!row.same_request) throw new WebApiError(409, 'Checkout key already used for a different request')
      const booking = row.booking_id ? await req.java(bookingPath(row.booking_id)) :
        await req.java('/api/court-bookings', 'POST', { ...input, idempotencyKey: 'web_' + row.id })
      // Reuse the upstream shared test hold and refuse to create an order for any other booking state.
      if (booking.testPayment !== true || booking.paymentOption !== input.paymentOption) {
        throw new WebApiError(502, 'The upstream service did not create a staging test hold')
      }
      if (!row.booking_id) {
        await db.query(`UPDATE ${checkouts} SET booking_id = $2 WHERE id = $1`, [row.id, booking.id])
      }
      if (booking.status !== 'PENDING' || row.gateway_order_id) return result(row, booking)
      const amount = paise(booking.amountDueNow)
      if (amount < 1) throw new WebApiError(502, 'Invalid test checkout amount')
      const order = await gateway('/orders', { amount, currency: 'INR', receipt: 'web_' + randomUUID() })
      if (!gatewayId(order?.id, 'order_') || order.currency !== 'INR' || order.amount !== amount) {
        throw new WebApiError(502, 'Invalid test order response')
      }
      await db.query(`UPDATE ${checkouts} SET booking_id = $2, gateway_order_id = $3, amount = $4 WHERE id = $1`,
        [row.id, booking.id, order.id, amount])
      return result({ ...row, gateway_order_id: order.id, amount }, booking)
    })
    res.status(201).json({ success: true, data: checkout })
  })

  async function reconcile(req, row) {
    let booking = await req.java(bookingPath(row.booking_id))
    if (booking.status === 'PENDING' && row.gateway_payment_id) {
      try {
        booking = await req.java(bookingPath(row.booking_id) + '/test-payment', 'POST', { scenario: 'SUCCESS' })
      } catch (error) {
        if (error.status !== 409) throw error
        booking = await req.java(bookingPath(row.booking_id))
        if (booking.status === 'PENDING') throw error
      }
    }
    return result(row, booking)
  }

  router.post(ordersPath + '/:checkoutId/verify', async (req, res) => {
    const row = await transaction(pool, async db => {
      const checkout = await ownedCheckout(db, req)
      const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body ?? {}
      if (!orderId && !paymentId && !signature && checkout.gateway_payment_id) return checkout
      if (!gatewayId(paymentId, 'pay_') || !checkout.gateway_order_id || orderId !== checkout.gateway_order_id ||
          !verifiedSignature(config.secret, checkout.gateway_order_id + '|' + paymentId, signature)) {
        throw new WebApiError(400, 'Invalid Razorpay payment signature')
      }
      const payment = await gateway('/payments/' + paymentId)
      if (payment.id !== paymentId) throw new WebApiError(409, 'Invalid Razorpay payment')
      return recordPayment(db, checkout, payment)
    })
    res.json({ success: true, data: await reconcile(req, row) })
  })

  router.get(ordersPath + '/:checkoutId', async (req, res) => {
    const row = await transaction(pool, db => ownedCheckout(db, req))
    const booking = await req.java(bookingPath(row.booking_id))
    res.json({ success: true, data: result(row, booking) })
  })

  router.delete(ordersPath + '/:checkoutId/hold', async (req, res) => {
    const released = await transaction(pool, async db => {
      const row = await ownedCheckout(db, req)
      if (row.gateway_payment_id) throw new WebApiError(409, 'This checkout has a captured test payment')
      const booking = await req.java(bookingPath(row.booking_id))
      if (booking.status === 'CONFIRMED') throw new WebApiError(409, 'A confirmed booking cannot be released')
      if (booking.status !== 'PENDING') return booking
      return req.java(bookingPath(row.booking_id) + '/test-payment', 'POST', { scenario: 'FAILURE' })
    })
    if (released.status === 'CONFIRMED') throw new WebApiError(409, 'A confirmed booking cannot be released')
    res.status(204).end()
  })

  return async (req, res) => {
    if (!config) throw new WebApiError(503, 'Web checkout is unavailable on this server')
    if (!Buffer.isBuffer(req.body) || !verifiedSignature(config.webhookSecret, req.body, req.get('x-razorpay-signature'))) {
      throw new WebApiError(400, 'Invalid Razorpay webhook signature')
    }
    let event
    try { event = JSON.parse(req.body) } catch { throw new WebApiError(400, 'Invalid Razorpay event') }
    const payment = event?.payload?.payment?.entity
    if (event?.event === 'payment.captured' && gatewayId(payment?.order_id, 'order_')) {
      await transaction(pool, async db => {
        const { rows: [row] } = await db.query(`SELECT * FROM ${checkouts} WHERE gateway_order_id = $1 FOR UPDATE`, [payment.order_id])
        if (row && checkCaptured(payment, row)) await recordPayment(db, row, payment)
      })
    }
    res.status(204).end()
  }
}
