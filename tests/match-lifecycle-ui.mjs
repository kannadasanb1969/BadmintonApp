import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { mkdir } from 'node:fs/promises'

await mkdir('node_modules/.cache', { recursive: true })
await build({ entryPoints: ['src/features/matches/utils/matchLifecycle.ts'], outfile: 'node_modules/.cache/match-lifecycle.mjs', bundle: true, platform: 'node', format: 'esm', packages: 'external' })
const { canShowMatchMutation, getCompletionBlockedReason, validWinningPoints } = await import('../node_modules/.cache/match-lifecycle.mjs')
const participant = { id: 'p', name: 'Player', code: 'P1', type: 'PLAYER' }
const match = { status: 'SCHEDULED', participant1: participant, participant2: participant, participant1Score: 0, participant2Score: 0 }
assert.equal(canShowMatchMutation('PUBLISHED', match, 'SCHEDULED', true), true)
assert.equal(canShowMatchMutation('PUBLISHED', match, 'LIVE', true), false)
const live = { ...match, status: 'LIVE', winningPoints: 15 }
assert.equal(canShowMatchMutation('PUBLISHED', live, 'LIVE', true), true)
assert.equal(canShowMatchMutation('PUBLISHED', live, 'LIVE', false), false)
assert.match(getCompletionBlockedReason(live), /tied/)
assert.match(getCompletionBlockedReason({ ...live, winningPoints: undefined }), /missing/)
assert.equal(getCompletionBlockedReason({ ...live, participant1Score: 15 }), null)
for (const points of [15, 21, 30]) assert.equal(validWinningPoints(points), points)
for (const points of [undefined, 0, 20, 31]) assert.equal(validWinningPoints(points), undefined)
assert.equal(canShowMatchMutation('PUBLISHED', { ...live, status: 'COMPLETED' }, 'LIVE', true), false)
console.log('PASS: scheduled/live/completed lifecycle visibility, organizer auth, tie/missing target guard and 15/21/30 targets')
