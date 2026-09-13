import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { mkdir } from 'node:fs/promises'

await mkdir('node_modules/.cache', { recursive: true })
await build({ entryPoints: ['src/features/matches/utils/matchLifecycle.ts'], outfile: 'node_modules/.cache/match-lifecycle.mjs', bundle: true, platform: 'node', format: 'esm', packages: 'external' })
const { canIncrementMatchScore, canShowMatchMutation, getCompletionBlockedReason, getMatchCompletionStatus, isMatchCompletionEligible, validWinningPoints } = await import('../node_modules/.cache/match-lifecycle.mjs')
const participant = { id: 'p', name: 'Player', code: 'P1', type: 'PLAYER' }
const match = { status: 'SCHEDULED', participant1: participant, participant2: participant, participant1Score: 0, participant2Score: 0 }
assert.equal(canShowMatchMutation('PUBLISHED', match, 'SCHEDULED', true), true)
assert.equal(canShowMatchMutation('PUBLISHED', { ...match, participant1: { ...participant, type: 'TEAM' }, participant2: { ...participant, type: 'TEAM' } }, 'SCHEDULED', true), true)
assert.equal(canShowMatchMutation('PUBLISHED', match, 'LIVE', true), false)
const live = { ...match, status: 'LIVE', winningPoints: 15 }
assert.equal(canShowMatchMutation('PUBLISHED', live, 'LIVE', true), true)
assert.equal(canShowMatchMutation('PUBLISHED', live, 'LIVE', false), false)
assert.match(getCompletionBlockedReason(live), /Reach 15/)
assert.match(getCompletionBlockedReason({ ...live, winningPoints: undefined }), /missing/)
const cases = [
  [15, 15, 15, false], [16, 15, 15, false], [17, 15, 15, true],
  [21, 21, 21, false], [22, 21, 21, false], [22, 22, 21, false], [23, 21, 21, true],
  [30, 30, 30, false], [31, 30, 30, false], [32, 30, 30, true],
  [40, 38, 30, true],
]
for (const [a, b, target, eligible] of cases) {
  const scoredMatch = { ...live, participant1Score: a, participant2Score: b, winningPoints: target }
  assert.equal(isMatchCompletionEligible(a, b, target), eligible, `${a}-${b}, target ${target}`)
  assert.equal(canIncrementMatchScore(scoredMatch), !eligible, `increment state ${a}-${b}, target ${target}`)
}
for (const [a, b] of [[32, 32], [33, 32], [34, 32]]) {
  assert.equal(canIncrementMatchScore({ ...live, participant1Score: a, participant2Score: b, winningPoints: 30 }), a !== 34)
}
assert.equal(getMatchCompletionStatus({ ...live, participant1Score: 15, participant2Score: 15 }), 'Two-point lead required')
assert.equal(getMatchCompletionStatus({ ...live, participant1Score: 16, participant2Score: 15 }), 'Two-point lead required')
assert.equal(getMatchCompletionStatus({ ...live, participant1Score: 17, participant2Score: 15 }), 'Match can be completed')
for (const points of [15, 21, 30]) assert.equal(validWinningPoints(points), points)
for (const points of [undefined, 0, 20, 31]) assert.equal(validWinningPoints(points), undefined)
assert.equal(canShowMatchMutation('PUBLISHED', { ...live, status: 'COMPLETED' }, 'LIVE', true), false)
assert.equal(canIncrementMatchScore({ ...live, status: 'COMPLETED' }), false)
console.log('PASS: 15/21/30 two-point lead matrix, scores above 30, singles/doubles lifecycle visibility, organizer auth and status messaging')
