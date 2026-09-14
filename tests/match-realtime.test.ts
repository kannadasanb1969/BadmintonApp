import assert from 'node:assert/strict'

class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  readonly url: string
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  onclose: ((event: { code: number }) => void) | null = null
  closed = false

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }
  open() { this.onopen?.() }
  message(value: unknown) { this.onmessage?.({ data: JSON.stringify(value) }) }
  close(code = 1000) { this.closed = true; this.onclose?.({ code }) }
}

Object.assign(globalThis, { WebSocket: FakeWebSocket, window: globalThis })

const { buildMatchRealtimeUrl, subscribeToMatchRealtime } = await import('../src/api/realtime/matchRealtime.ts')

assert.equal(buildMatchRealtimeUrl('match /1', 'secret'), 'ws://localhost:8787/api/realtime/matches/match%20%2F1?token=secret')
const events: Array<{ matchId: string; participant1Score: number }> = []
const states: string[] = []
let reconnects = 0
const unsubscribeA = subscribeToMatchRealtime('a', 'secret', {
  onEvent: event => events.push(event),
  onStateChange: state => states.push(state),
  onReconnect: () => { reconnects += 1 },
})
const unsubscribeB = subscribeToMatchRealtime('b', 'secret', { onEvent: event => events.push(event) })
assert.equal(FakeWebSocket.instances.length, 2)
const socketA = FakeWebSocket.instances[0]
socketA.open()
socketA.message({ type: 'MATCH_SCORE_UPDATED', matchId: 'a', status: 'LIVE', participant1Score: 24, participant2Score: 22, winningPoints: 21 })
socketA.message({ type: 'MATCH_SCORE_UPDATED', matchId: 'b', status: 'LIVE', participant1Score: 99, participant2Score: 0 })
assert.deepEqual(events, [{ type: 'MATCH_SCORE_UPDATED', matchId: 'a', status: 'LIVE', participant1Score: 24, participant2Score: 22, winningPoints: 21 }])
assert.ok(states.includes('CONNECTED'))

socketA.close(1006)
await new Promise(resolve => setTimeout(resolve, 1050))
assert.equal(FakeWebSocket.instances.length, 3)
FakeWebSocket.instances[2].open()
assert.equal(reconnects, 1)

unsubscribeA()
unsubscribeB()
assert.equal(FakeWebSocket.instances[1].closed, true)
assert.equal(FakeWebSocket.instances[2].closed, true)
console.log('PASS: URL derivation, absolute events, match isolation, reconnect callback and socket cleanup')
