import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { friendlyLifecycleAction } from '../src/features/friendly/components/FriendlyLifecycleActions'
import { isFriendlyWinningScore } from '../src/features/friendly/utils/friendlyScoring'

const service = await readFile('src/features/friendly/services/friendlyService.ts', 'utf8')
for (const contract of [
  '/api/friendly-matches', '/join', '/join-requests', '/participants', '/teams', '/shuffle-partners',
  '/fixtures', '/start', '/score', '/complete', '/result', '/standings', '/close', '/cleanup',
]) assert.ok(service.includes(contract), `Missing Friendly service contract: ${contract}`)
assert.doesNotMatch(service, /\bfetch\s*\(/)

const hooks = await readFile('src/features/friendly/hooks/friendlyHooks.ts', 'utf8')
for (const key of ['all', 'detail', 'joinRequests', 'participants', 'teams', 'fixtures', 'result', 'standings']) assert.match(hooks, new RegExp(`${key}:`))
assert.match(hooks, /setQueryData<FriendlyFixtureData>/)
assert.match(hooks, /removeQueries/)

const details = await readFile('src/features/friendly/pages/FriendlyDetailsPage.tsx', 'utf8')
assert.doesNotMatch(details, /creator_player_id\s*===|===\s*.*creator_player_id/)
assert.match(details, /match\.isCreator/)
assert.match(details, /canShowJoinRequests && <FriendlyJoinRequests/)
assert.match(details, /operational && canShowTeamSetup/)
assert.doesNotMatch(details, /<FriendlyLifecycleActions match=/)

const fixtures = await readFile('src/features/friendly/components/FriendlyFixtures.tsx', 'utf8')
assert.match(fixtures, /overflow-x-auto/)
assert.match(fixtures, /h-11 w-11/)
assert.match(fixtures, /aria-label={`Increment/)
assert.match(fixtures, /aria-label={`Decrement/)
assert.doesNotMatch(fixtures, /BYE/)

for (const target of [15, 21, 30]) {
  assert.equal(isFriendlyWinningScore(target, target, target), false)
  assert.equal(isFriendlyWinningScore(target + 1, target, target), false)
  assert.equal(isFriendlyWinningScore(target + 2, target, target), true)
}
assert.equal(isFriendlyWinningScore(40, 38, 30), true)

assert.equal(friendlyLifecycleAction('COMPLETED', true), 'CLOSE')
assert.equal(friendlyLifecycleAction('CLEANUP_PENDING', true), 'CLEANUP')
for (const status of ['DRAFT', 'OPEN', 'ACTIVE', 'DELETED'] as const) assert.equal(friendlyLifecycleAction(status, true), null)
assert.equal(friendlyLifecycleAction('COMPLETED', false), null)
assert.equal(friendlyLifecycleAction('CLEANUP_PENDING', false), null)

const realtime = await readFile('src/features/friendly/hooks/useFriendlyLiveUpdates.ts', 'utf8')
assert.match(realtime, /applyFriendlyAbsoluteScore/)
assert.doesNotMatch(realtime, /participant1Score\s*[+]\s*1|participant2Score\s*[+]\s*1/)
for (const key of ['fixtures', 'detail', 'result', 'standings']) assert.match(realtime, new RegExp(`friendlyKeys\\.${key}`))

const results = await readFile('src/features/friendly/components/FriendlyResults.tsx', 'utf8')
assert.match(results, />Played</); assert.match(results, />Won</); assert.match(results, />Lost</)
assert.doesNotMatch(results, />Points</)
assert.match(results, /TIE_BREAK_REQUIRED/); assert.match(results, /CLEAR_LEADER/)

const lifecycle = await readFile('src/features/friendly/components/FriendlyLifecycleActions.tsx', 'utf8')
assert.match(lifecycle, /role="dialog"/); assert.match(lifecycle, /aria-labelledby/); assert.match(lifecycle, /aria-describedby/)
assert.equal(lifecycle.match(/await close\.mutateAsync\(\)/g)?.length, 1)
assert.equal(lifecycle.match(/await cleanup\.mutateAsync\(\)/g)?.length, 1)
assert.match(lifecycle, /if \(confirming === 'CLOSE'\).*else/)

console.log('PASS: 71 cross-batch Friendly assertions for complete contracts, role/status safety, scoring, realtime, results, cache lifecycle, responsive UI and accessibility')
