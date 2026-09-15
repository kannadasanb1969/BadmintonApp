import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import apiClient from '../src/api/apiClient'
import { FriendlyFixtureView, friendlyKnockoutRounds, orderedFriendlyMatches, resolveFriendlyParticipant } from '../src/features/friendly/components/FriendlyFixtures'
import { friendlyKeys, invalidateFriendlyTeams } from '../src/features/friendly/hooks/friendlyHooks'
import { friendlyService } from '../src/features/friendly/services/friendlyService'

const participants = Array.from({ length: 6 }, (_, index) => ({ id: `row-${index}`, friendly_match_id: 'f', player_id: `p${index + 1}`, created_at: '', full_name: `Player ${index + 1}`, player_code: `PLR00${index + 1}` }))
const teams = [{ id: 't1', friendly_match_id: 'f', team_code: 'TEAM001', created_at: '', updated_at: '', members: [{ id: 'p1', name: 'Player 1', code: 'PLR001' }, { id: 'p2', name: 'Player 2', code: 'PLR002' }] }]
const makeMatch = (index: number, round = 1, p1: string | null = 'p1', p2: string | null = 'p2', type: 'PLAYER' | 'TEAM' = 'PLAYER') => ({ id: `m${index}`, friendly_match_id: 'f', fixture_id: 'fx', match_code: `MATCH${index}`, round_number: round, match_number: index, status: 'SCHEDULED' as const, participant1_id: p1, participant1_type: p1 ? type : null, participant2_id: p2, participant2_type: p2 ? type : null, participant1_score: index, participant2_score: 0, winning_points: null, source_match_1_id: null, source_match_2_id: null, next_match_id: null, next_match_slot: null, started_at: null, completed_at: null, created_at: '', updated_at: '' })
const fixture = (format: 'LEAGUE' | 'KNOCKOUT', matches) => ({ fixture: { id: 'fx', friendly_match_id: 'f', fixture_code: 'FIX001', format, status: 'DRAFT' as const, created_at: '', updated_at: '' }, matches })
const renderFixture = (data, fixtureParticipants = participants, fixtureTeams = teams) => renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><FriendlyFixtureView data={data} participants={fixtureParticipants} teams={fixtureTeams} /></QueryClientProvider>)

assert.equal(resolveFriendlyParticipant('p1', 'PLAYER', participants, []).title, 'Player 1')
assert.equal(resolveFriendlyParticipant('p1', 'PLAYER', participants, []).subtitle, 'PLR001')
assert.equal(resolveFriendlyParticipant('row-0', 'PLAYER', participants, []).title, 'TBD')
assert.equal(resolveFriendlyParticipant('t1', 'TEAM', participants, teams).title, 'TEAM001')
assert.match(resolveFriendlyParticipant('t1', 'TEAM', participants, teams).subtitle ?? '', /Player 1/)
assert.equal(resolveFriendlyParticipant(null, null, participants, teams).title, 'TBD')

const koMatches = [makeMatch(7, 3, null, null), makeMatch(3), makeMatch(1), makeMatch(6, 2, null, null), makeMatch(2), makeMatch(5, 2, null, null), makeMatch(4)]
assert.deepEqual(friendlyKnockoutRounds(koMatches).map(([round, rows]) => [round, rows.length]), [[1, 4], [2, 2], [3, 1]])
assert.deepEqual(orderedFriendlyMatches(koMatches).map(row => row.id), ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'])
const ko = renderFixture(fixture('KNOCKOUT', koMatches), participants, [])
assert.match(ko, /Knockout Bracket/); assert.match(ko, /Round 1/); assert.match(ko, /Round 2/); assert.match(ko, /Final/)
assert.match(ko, /Player 1/); assert.match(ko, /PLR001/); assert.match(ko, /TBD/); assert.doesNotMatch(ko, /BYE/)
assert.match(ko, /MATCH1/); assert.match(ko, />1</); assert.match(ko, /SCHEDULED/); assert.match(ko, /overflow-x-auto/)
assert.doesNotMatch(ko, /Winner|Standings|Points/)

const doublesKo = renderFixture(fixture('KNOCKOUT', [makeMatch(1, 1, 't1', null, 'TEAM'), makeMatch(2, 1, 't1', null, 'TEAM'), makeMatch(3, 2, null, null, 'TEAM')]))
assert.match(doublesKo, /TEAM001/); assert.match(doublesKo, /Player 1 \/ Player 2/); assert.match(doublesKo, /TBD/)

const singlesLeague = Array.from({ length: 15 }, (_, index) => makeMatch(index + 1))
const league = renderFixture(fixture('LEAGUE', singlesLeague), participants, [])
assert.match(league, /League Schedule/); assert.equal((league.match(/MATCH\d+/g) ?? []).length, 15); assert.doesNotMatch(league, /Standings|Points/); assert.doesNotMatch(league, /Round 2/)
const doublesLeague = renderFixture(fixture('LEAGUE', Array.from({ length: 6 }, (_, index) => makeMatch(index + 1, 1, 't1', 't1', 'TEAM'))))
assert.equal((doublesLeague.match(/MATCH\d+/g) ?? []).length, 6); assert.match(doublesLeague, /TEAM001/); assert.match(doublesLeague, /sm:grid-cols-2/)

const originalGet = apiClient.get; const originalPost = apiClient.post; const calls: Array<{ method: string; path: string; body?: unknown }> = []
apiClient.get = async path => { calls.push({ method: 'GET', path }); return { data: fixture('KNOCKOUT', koMatches) } as never }
apiClient.post = async (path, body) => { calls.push({ method: 'POST', path, body }); return { data: fixture('KNOCKOUT', koMatches) } as never }
try {
  assert.equal((await friendlyService.getFixtures('f')).fixture.id, 'fx')
  await friendlyService.generateFixtures('f'); await friendlyService.resetFixtures('f')
  assert.equal(calls.find(call => call.method === 'GET')?.path, '/api/friendly-matches/f/fixtures')
  assert.deepEqual(calls.find(call => call.method === 'POST' && call.path.endsWith('/fixtures'))?.body, {})
  assert.deepEqual(calls.find(call => call.path.endsWith('/fixtures/reset'))?.body, {})
} finally { apiClient.get = originalGet; apiClient.post = originalPost }
const invalidated: string[] = []
await invalidateFriendlyTeams({ invalidateQueries: async ({ queryKey }) => { invalidated.push(queryKey.join('/')) } } as never, 'f')
assert.ok(invalidated.includes(friendlyKeys.fixtures('f').join('/'))); assert.ok(invalidated.includes(friendlyKeys.teams('f').join('/'))); assert.ok(invalidated.includes(friendlyKeys.detail('f').join('/')))
console.log('PASS: 41 Friendly fixture assertions for exact APIs, KO/League ordering, PLAYER/TEAM lookup, TBD, controls data and invalidation')
