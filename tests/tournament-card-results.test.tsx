import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import apiClient from '../src/api/apiClient'
import { resultService } from '../src/features/results/services/resultService'
import { useResultStore } from '../src/features/fixtures/store/resultStore'
import { useTournamentStore } from '../src/features/tournaments/store/tournamentStore'
import Page from '../src/features/player/pages/PlayerTournamentListPage'
import { completedCategoryResults, isTournamentCompleted, TournamentCardResults } from '../src/features/player/components/TournamentCardResults'
import { filterPlayerTournaments, tournamentListStatus } from '../src/features/player/utils/tournamentListFilters'

const category = { id: 'c', name: 'Singles', eventType: 'SINGLES', registrationPhase: 'CLOSED' }
const tournament = { id: 't', name: 'Completed Singles', status: 'PUBLISHED', createdAt: '2026-09-12', categories: [category], tournamentDate: '2026-09-30', registrationCloseDate: '2099-09-28', registrationCloseTime: '18:00', venueName: 'SmashPoint Court', registeredPlayerCount: 4 }
const result = { id: 'r', tournamentId: 't', categoryId: 'c', completedAt: '2026-09-12T01:00:00Z', winnerParticipantId: 'p1', runnerUpParticipantId: 'p2', winnerParticipantType: 'PLAYER', runnerUpParticipantType: 'PLAYER' }
const original = apiClient.get
let count = 0
let rows = [result, { ...result, id: 'd', tournamentId: 'd', winnerParticipantId: 'team1', runnerUpParticipantId: 'team2', winnerParticipantType: 'TEAM', runnerUpParticipantType: 'TEAM' }]
const players = [{ id: 'p1', fullName: 'Karthik', playerCode: 'PLY1' }, { id: 'p2', fullName: 'Mr X', playerCode: 'PLY2' }]
apiClient.get = async (path) => {
  count++
  const data = {
    '/api/results': rows,
    '/api/tournaments': [tournament, { ...tournament, id: 'd' }],
    '/api/players': players,
    '/api/guest-players': [{ id: 'guest', fullName: 'Guest Partner' }],
    '/api/teams': [
      { id: 'team1', teamCode: 'TEM1', player1: { id: 'p1', type: 'PLAYER' }, player2: { id: 'guest', type: 'GUEST' } },
      { id: 'team2', teamCode: 'TEM2', player1: { id: 'p1', type: 'PLAYER' }, player2: { id: 'p2', type: 'PLAYER' } },
    ],
  }[path]
  assert.ok(data, `Unexpected per-item request: ${path}`)
  return { data }
}
let results
try {
  ;[results] = await Promise.all([resultService.getResults(), resultService.getResults()])
  assert.equal(count, 5, 'concurrent calls share one bulk load')
  assert.equal(results[0].winnerParticipantName, 'Karthik')
  assert.equal(results[0].runnerUpParticipantName, 'Mr X')
  assert.equal(results[1].winnerParticipantName, 'Karthik / Guest Partner')
  assert.equal(results[1].runnerUpParticipantName, 'Karthik / Mr X')
  rows = Array.from({ length: 50 }, (_, index) => ({ ...rows[index % 2], id: String(index) }))
  count = 0
  await resultService.getResults()
  assert.equal(count, 5, 'request count stays constant for 50 results')
} finally { apiClient.get = original }

assert.equal(isTournamentCompleted(tournament, []), false)
assert.equal(isTournamentCompleted(tournament, results), true)
assert.equal(isTournamentCompleted({ ...tournament, categories: [category, { ...category, id: 'other' }] }, results), false)
assert.equal(completedCategoryResults(tournament, [{ ...results[0], completedAt: 'invalid' }]).length, 0)
const doubles = { ...tournament, id: 'd', name: 'Completed Doubles', categories: [{ ...category, eventType: 'DOUBLES' }] }
const open = { ...tournament, id: 'o', name: 'Open Tournament', categories: [{ ...category, registrationPhase: 'OPEN' }] }
const closed = { ...tournament, id: 'closed', name: 'Closed Tournament' }
useTournamentStore.setState({ tournaments: [open, closed, tournament, doubles], loading: false, error: null })
useResultStore.setState({ results })
Object.assign(useTournamentStore.getInitialState(), useTournamentStore.getState())
Object.assign(useResultStore.getInitialState(), useResultStore.getState())
const html = renderToStaticMarkup(<MemoryRouter><Page /></MemoryRouter>)
const cards = html.match(/<article[\s\S]*?<\/article>/g)
assert.match(cards[0], /bg-emerald-50[^>]*>OPEN NOW/)
assert.doesNotMatch(cards[0], /🏆 Winner/)
assert.equal(cards.length, 1)
assert.doesNotMatch(html, /type="checkbox"/)
assert.match(html, /value="OPEN" selected=""/)
const now = new Date('2026-09-12T00:00:00Z')
const tournaments = [open, closed, tournament, doubles]
for (const [status, ids] of [['OPEN', ['o']], ['CLOSED', ['closed']], ['COMPLETED', ['t', 'd']], ['ALL', ['o', 'closed', 't', 'd']]]) {
  assert.deepEqual(filterPlayerTournaments(tournaments, results, '', 'ALL', status, now).map(item => item.id), ids)
}
assert.deepEqual(filterPlayerTournaments(tournaments, results, 'completed', 'DOUBLES', 'COMPLETED', now).map(item => item.id), ['d'])
assert.equal(filterPlayerTournaments(tournaments, results, 'no match', 'ALL', 'OPEN', now).length, 0)
assert.equal(tournamentListStatus({ ...open, registrationCloseDate: '2026-09-11' }, results, now), 'CLOSED')
assert.equal(tournamentListStatus({ ...open, categories: [{ ...open.categories[0], registrationClosedAt: '2026-09-12' }] }, results, now), 'CLOSED')
const sorted = filterPlayerTournaments([{ ...open, createdAt: 'invalid' }, { ...closed, createdAt: '2026-09-10' }, { ...tournament, createdAt: '2026-09-12' }], results, '', 'ALL', 'ALL', now)
assert.deepEqual(sorted.map(item => item.id), ['t', 'closed', 'o'])
assert.deepEqual(tournaments.map(item => item.id), ['o', 'closed', 't', 'd'])
const singlesHTML = renderToStaticMarkup(<TournamentCardResults tournament={tournament} results={results} />)
assert.match(singlesHTML, /Karthik/); assert.match(singlesHTML, /Mr X/); assert.match(singlesHTML, /PLY1/)
const doublesHTML = renderToStaticMarkup(<TournamentCardResults tournament={doubles} results={results} />)
assert.match(doublesHTML, /Karthik \/ Guest Partner/); assert.match(doublesHTML, /Karthik \/ Mr X/)
const missing = renderToStaticMarkup(<TournamentCardResults tournament={tournament} results={[{ ...results[0], winnerParticipantName: result.winnerParticipantId, runnerUpParticipantName: 'abc12345-1234-1234-1234-123456789abc' }]} />)
assert.match(missing, /Result pending/)
assert.doesNotMatch(missing, /abc12345-1234-1234-1234-123456789abc/)
console.log('PASS: default Open dropdown, all four statuses, combined filters, sort, singles/doubles/guest results and bounded bulk requests')
