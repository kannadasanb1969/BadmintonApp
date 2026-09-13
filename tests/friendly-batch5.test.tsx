import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import apiClient from '../src/api/apiClient'
import { FriendlyFixtureView } from '../src/features/friendly/components/FriendlyFixtures'
import { friendlyService } from '../src/features/friendly/services/friendlyService'
import { applyFriendlyAbsoluteScore, friendlyScoreError, isFriendlyWinningScore, replaceFriendlyFixtureMatch } from '../src/features/friendly/utils/friendlyScoring'

for (const target of [15, 21, 30]) {
  assert.equal(isFriendlyWinningScore(target, target, target), false)
  assert.equal(isFriendlyWinningScore(target + 1, target, target), false)
  assert.equal(isFriendlyWinningScore(target + 2, target, target), true)
  assert.equal(isFriendlyWinningScore(target + 3, target + 1, target), true)
}
assert.equal(isFriendlyWinningScore(31, 30, 30), false)
assert.equal(isFriendlyWinningScore(32, 30, 30), true)
assert.equal(isFriendlyWinningScore(40, 38, 30), true)
assert.equal(friendlyScoreError('Match has reached a valid winning score. Complete the match or correct the score.'), 'Winning score reached. Complete the match or correct the score.')

const players = [{ id: 'row1', friendly_match_id: 'f', player_id: 'p1', created_at: '', full_name: 'Arun', player_code: 'PLR001' }, { id: 'row2', friendly_match_id: 'f', player_id: 'p2', created_at: '', full_name: 'Bala', player_code: 'PLR002' }]
const baseMatch = { id: 'm1', friendly_match_id: 'f', fixture_id: 'fx', match_code: 'MATCH1', round_number: 1, match_number: 1, status: 'SCHEDULED' as const, participant1_id: 'p1', participant1_type: 'PLAYER' as const, participant2_id: 'p2', participant2_type: 'PLAYER' as const, participant1_score: 0, participant2_score: 0, winning_points: null, source_match_1_id: null, source_match_2_id: null, next_match_id: null, next_match_slot: null, started_at: null, completed_at: null, created_at: '', updated_at: '' }
const data = match => ({ fixture: { id: 'fx', friendly_match_id: 'f', fixture_code: 'FIX1', format: 'KNOCKOUT' as const, status: 'DRAFT' as const, created_at: '', updated_at: '' }, matches: [match] })
const render = (match, isCreator) => renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><FriendlyFixtureView data={data(match)} participants={players} teams={[]} isCreator={isCreator} /></QueryClientProvider>)
const scheduled = render(baseMatch, true)
assert.match(scheduled, /Start Match/); assert.match(scheduled, />15</); assert.match(scheduled, />21</); assert.match(scheduled, />30</)
assert.match(scheduled, /disabled=""/)
const readonly = render(baseMatch, false); assert.doesNotMatch(readonly, /Start Match|Increment Arun|Complete Match/)
const live = { ...baseMatch, status: 'LIVE' as const, participant1_score: 15, participant2_score: 15, winning_points: 15 }
const liveHtml = render(live, true)
assert.match(liveHtml, /Target: 15/); assert.match(liveHtml, /Increment Arun/); assert.match(liveHtml, /Decrement Arun/); assert.doesNotMatch(liveHtml, /Winning score reached/)
const zero = render({ ...live, participant1_score: 0 }, true); assert.match(zero, /Decrement Arun" disabled/)
const extended = render({ ...live, participant1_score: 17 }, true)
assert.match(extended, /Winning score reached/); assert.match(extended, /Increment Arun" disabled/); assert.match(extended, /Complete Match/)
const corrected = render({ ...live, participant1_score: 16 }, true); assert.doesNotMatch(corrected, /Winning score reached/); assert.doesNotMatch(corrected, /Increment Arun" disabled/)
const complete = render({ ...live, status: 'COMPLETED' as const, participant1_score: 17 }, true)
assert.match(complete, /Final score · Match completed/); assert.doesNotMatch(complete, /Increment Arun|Decrement Arun|Complete Match|Start Match/)
const completedWithWinner = applyFriendlyAbsoluteScore(live, { status: 'COMPLETED', participant1Score: 17, participant2Score: 15, winningPoints: 15, winnerId: 'p1', winnerType: 'PLAYER' })
assert.equal(completedWithWinner.live_winner_id, 'p1'); assert.match(render(completedWithWinner, true), /Winner: Arun/)

const absolute = applyFriendlyAbsoluteScore(live, { status: 'LIVE', participant1Score: 8, participant2Score: 6, winningPoints: 15, updatedAt: 'new' })
assert.equal(absolute.participant1_score, 8); assert.equal(absolute.participant2_score, 6); assert.equal(absolute.updated_at, 'new')
assert.equal(applyFriendlyAbsoluteScore(live, { status: 'LIVE', participant1Score: -1, participant2Score: 0 }).participant1_score, 0)
assert.equal(replaceFriendlyFixtureMatch(data(live), absolute)?.matches[0].participant1_score, 8)

const originalPost = apiClient.post; const calls: Array<{ path: string; body: unknown }> = []
apiClient.post = async (path, body) => { calls.push({ path, body }); return { data: { ...live, status: path.endsWith('/complete') ? 'COMPLETED' : 'LIVE' } } as never }
try {
  await friendlyService.startMatch('f', 'm1', 21)
  await friendlyService.scoreMatch('f', 'm1', 'A', 'INCREMENT')
  await friendlyService.scoreMatch('f', 'm1', 'B', 'DECREMENT')
  await friendlyService.completeMatch('f', 'm1')
  assert.deepEqual(calls[0], { path: '/api/friendly-matches/f/matches/m1/start', body: { winningPoints: 21 } })
  assert.deepEqual(calls[1].body, { side: 'A', action: 'INCREMENT' })
  assert.deepEqual(calls[2].body, { side: 'B', action: 'DECREMENT' })
  assert.deepEqual(calls[3], { path: '/api/friendly-matches/f/matches/m1/complete', body: {} })
} finally { apiClient.post = originalPost }
console.log('PASS: 41 Friendly scoring assertions for exact REST bodies, creator UI, 15/21/30 win rules, correction, completion, winner and absolute scores')
