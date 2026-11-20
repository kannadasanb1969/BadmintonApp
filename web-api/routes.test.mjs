import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createECDH, createHmac, randomBytes } from 'node:crypto'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { createApp, webPrefix } from './app.mjs'
import { WebApiError } from './java.mjs'
import { deliverPush } from './push.mjs'

test('web endpoint contracts across push, tournament and test checkout', async t => {
  const db = new PGlite()
  await db.exec(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'))
  await db.exec(`CREATE TABLE notifications (
    id text PRIMARY KEY, recipient_id text NOT NULL, recipient_role text NOT NULL,
    is_read boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
  )`)
  const pool = { query: db.query.bind(db), connect: async () => ({ query: db.query.bind(db), release() {} }) }
  const token = sub => 'Bearer test.' + Buffer.from(JSON.stringify({ sub })).toString('base64url') + '.signature'
  const player = { id: 'player-1', role: 'PLAYER', isActive: true }
  const organizer = { id: 'organizer-1', role: 'ORGANIZER', isActive: true }
  const stranger = { id: 'player-2', role: 'PLAYER', isActive: true }
  const users = [player, organizer, stranger]
  const tournament = { organizerId: organizer.id, fixtureFormat: 'KNOCKOUT',
    categories: [{ id: 'singles', maxTeams: 16 }, { id: 'doubles' }] }
  let teams = 2
  let orders = 0
  let confirmations = 0
  const bookings = new Map()
  let verifiedAmount = 30000
  const payment = { keyId: 'rzp_test_runner', secret: 'checkout-secret', webhookSecret: 'webhook-secret' }
  const captured = { id: 'pay_123456', order_id: 'order_test1', status: 'captured', amount: verifiedAmount, currency: 'INR' }
  const signature = (secret, value) => createHmac('sha256', secret).update(value).digest('hex')
  const java = async (auth, path, method, body) => {
    const user = users.find(user => auth === token(user.id))
    if (!user) throw new WebApiError(401, 'Authentication required')
    if (path === '/api/users/' + user.id) return user
    if (path === '/api/tournaments/t1') {
      if (method === 'PUT') {
        for (const update of body.categories) Object.assign(tournament.categories.find(item => item.id === update.id), update)
        tournament.categories = tournament.categories.filter(item => !body.removedCategoryIds?.includes(item.id))
      }
      return tournament
    }
    if (path === '/api/fixtures/generate') {
      assert.equal(body.organizerUserId, organizer.id)
      if (teams < tournament.categories[0].minTeams) throw new WebApiError(409, 'Not enough confirmed teams')
      return { id: 'fixture-1' }
    }
    if (path === '/api/court-bookings') {
      assert.match(body.idempotencyKey, /^web_/)
      const id = 'booking-' + (bookings.size + 1)
      const booking = { id, testPayment: true, amountDueNow: '300.00', status: 'PENDING', paymentOption: body.paymentOption }
      bookings.set(id, booking)
      return booking
    }
    const [, , , id, action] = path.split('/')
    const booking = bookings.get(id)
    if (!booking) throw new WebApiError(404, 'Booking not found')
    if (action === 'test-payment' && booking.status === 'PENDING') {
      if (body.scenario === 'SUCCESS') confirmations++
      booking.status = body.scenario === 'SUCCESS' ? 'CONFIRMED' : 'CANCELLED'
    }
    return booking
  }
  const gateway = async (path, body) => {
    if (path === '/orders') {
      orders++
      assert.equal(body.amount, 30000)
      return { id: 'order_test' + orders, amount: body.amount, currency: 'INR' }
    }
    assert.equal(path, '/payments/' + captured.id)
    return { ...captured, amount: verifiedAmount }
  }
  const app = createApp({ pool, java, origins: ['http://localhost:5173'], push: {}, payment, tournaments: true, gateway })
  const server = app.listen(0)
  await once(server, 'listening')
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await db.close() })
  const call = async (method, path, user, body, headers = {}) => {
    const response = await fetch('http://localhost:' + server.address().port + path, {
      method, headers: { 'Content-Type': 'application/json', ...(user ? { authorization: token(user.id) } : {}), ...headers },
      body: typeof body === 'string' ? body : body === undefined ? undefined : JSON.stringify(body),
    })
    return { status: response.status, data: response.status === 204 ? undefined : await response.json() }
  }
  const api = (method, path, ...args) => call(method, webPrefix + path, ...args)
  const push = '/push/subscriptions'
  const fixture = '/tournaments/t1/categories/singles/fixtures'
  const minimum = '/tournaments/t1/categories/singles/minimum-teams'
  const checkout = '/court-bookings/checkouts'
  const webhook = '/webhooks/razorpay'

  assert.equal((await call('POST', '/api/push/subscriptions', player)).status, 404)
  assert.equal((await api('POST', push)).status, 401)
  assert.equal((await api('POST', push, player, { endpoint: 'https://127.0.0.1/api' })).status, 400)
  const key = createECDH('prime256v1').generateKeys().toString('base64url')
  const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/fake', keys: { p256dh: key, auth: randomBytes(16).toString('base64url') } }
  const subscribed = await api('POST', push, player, subscription)
  assert.equal(subscribed.status, 201)
  const subId = subscribed.data.data.subscriptionId
  assert.equal((await api('POST', push, stranger, subscription)).status, 409)
  assert.equal((await api('DELETE', push + '/' + subId, stranger)).status, 204)
  await db.query(`INSERT INTO notifications (id, recipient_id, recipient_role) VALUES ('n1',$1,$2), ('n2',$3,$2)`,
    [player.id, player.role, stranger.id])
  const sent = []
  await deliverPush(pool, {}, async (_destination, payload) => { sent.push(JSON.parse(payload)) })
  await deliverPush(pool, {}, async () => { throw new Error('duplicate') })
  assert.deepEqual(sent, [{ id: 'n1', role: 'PLAYER' }])
  assert.equal((await api('DELETE', push + '/' + subId, player)).status, 204)
  assert.equal((await db.query('SELECT COUNT(*) FROM smashkaro_web.push_subscriptions')).rows[0].count, 0)

  assert.equal((await api('PATCH', minimum, player, { minTeams: 3 })).status, 403)
  assert.equal((await api('PATCH', minimum, organizer, { minTeams: 17 })).status, 400)
  assert.equal((await api('PATCH', minimum, organizer, { minTeams: 3 })).data.data.minTeams, 3)
  assert.equal((await api('POST', fixture, organizer, { format: 'KNOCKOUT' })).status, 409)
  teams = 3
  assert.equal((await api('POST', fixture, organizer, { format: 'KNOCKOUT' })).status, 201)
  assert.equal((await api('DELETE', '/tournaments/t1/categories/doubles', organizer)).status, 204)
  assert.equal(tournament.categories.length, 1)

  const input = { venueId: 'venue1', bookingDate: '2030-11-20', startTime: '10:00', endTime: '11:00',
    quotedAmount: '1000.00', paymentOption: 'ADVANCE_30', idempotencyKey: 'stable-request' }
  const started = await api('POST', checkout, player, input)
  assert.equal(started.status, 201)
  const checkoutData = started.data.data
  const path = checkout + '/' + checkoutData.checkoutId
  assert.equal(checkoutData.order.amount, 30000)
  assert.equal((await api('POST', checkout, player, input)).data.data.checkoutId, checkoutData.checkoutId)
  assert.equal(orders, 1)
  assert.equal(bookings.size, 1)
  assert.equal((await api('POST', checkout, player, { ...input, startTime: '09:00' })).status, 409)
  assert.equal((await api('GET', path, stranger)).status, 404)
  assert.equal((await api('POST', path + '/verify', player, {})).status, 400)
  const proof = { razorpay_order_id: captured.order_id, razorpay_payment_id: captured.id,
    razorpay_signature: signature(payment.secret, captured.order_id + '|' + captured.id) }
  verifiedAmount = 29999
  assert.equal((await api('POST', path + '/verify', player, proof)).status, 409)
  const event = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: captured } } })
  const header = { 'x-razorpay-signature': signature(payment.webhookSecret, event) }
  assert.equal((await api('POST', webhook, undefined, event + ' ', header)).status, 400)
  assert.equal((await api('POST', webhook, undefined, event, header)).status, 204)
  assert.equal((await api('POST', webhook, undefined, event, header)).status, 204)
  assert.equal((await api('GET', path, player)).data.data.paymentStatus, 'CAPTURED')
  assert.equal((await api('DELETE', path + '/hold', player)).status, 409)
  assert.equal((await api('POST', path + '/verify', player, {})).data.data.booking.status, 'CONFIRMED')
  verifiedAmount = 30000
  assert.equal((await api('POST', path + '/verify', player, proof)).data.data.booking.status, 'CONFIRMED')
  assert.equal(confirmations, 1)
  const abandoned = (await api('POST', checkout, player, { ...input, idempotencyKey: 'another-request' })).data.data
  const abandonedPath = checkout + '/' + abandoned.checkoutId
  assert.equal((await api('DELETE', abandonedPath + '/hold', player)).status, 204)
  assert.equal((await api('DELETE', abandonedPath + '/hold', player)).status, 204)
  assert.equal((await api('GET', abandonedPath, player)).data.data.booking.status, 'CANCELLED')
})
