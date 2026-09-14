import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import apiClient from '../src/api/apiClient'
import { FriendlyHomePage } from '../src/features/friendly/pages/FriendlyHomePage'
import { FriendlyMatchCard, participantCount } from '../src/features/friendly/components/FriendlyMatchCard'
import { FriendlyUserAction, friendlyUserLabel } from '../src/features/friendly/components/FriendlyUserAction'
import { friendlyService } from '../src/features/friendly/services/friendlyService'
import { friendlyDetailsPath, validateFriendlyMatch } from '../src/features/friendly/utils/friendlyValidation'
import { invalidateFriendlyAfterJoin } from '../src/features/friendly/hooks/friendlyHooks'
import { FriendlyCreatePage } from '../src/features/friendly/pages/FriendlyCreatePage'
import { FriendlyBrowsePage } from '../src/features/friendly/pages/FriendlyBrowsePage'
import { FriendlyDetailsPage } from '../src/features/friendly/pages/FriendlyDetailsPage'
import { FriendlyMatchListContent } from '../src/features/friendly/components/FriendlyMatchList'

const base = { title: 'Sunday Smash', description: null, eventType: 'SINGLES' as const, format: 'LEAGUE' as const, maxPlayers: 6 }
assert.equal(validateFriendlyMatch(base), null)
assert.match(validateFriendlyMatch({ ...base, maxPlayers: 5 }) ?? '', /6 to 16/)
assert.match(validateFriendlyMatch({ ...base, maxPlayers: 17 }) ?? '', /6 to 16/)
assert.match(validateFriendlyMatch({ ...base, eventType: 'DOUBLES', maxPlayers: 6 }) ?? '', /8 to 16/)
assert.match(validateFriendlyMatch({ ...base, eventType: 'DOUBLES', maxPlayers: 9 }) ?? '', /even/)
assert.equal(validateFriendlyMatch({ ...base, eventType: 'DOUBLES', maxPlayers: 16 }), null)
assert.equal(friendlyDetailsPath('returned-id'), '/player/friendly-matches/returned-id')
assert.equal(participantCount('4'), 4)
const createPage = renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><MemoryRouter><FriendlyCreatePage /></MemoryRouter></QueryClientProvider>)
assert.match(createPage, /Title/); assert.match(createPage, /Max Players/); assert.match(createPage, /Create Friendly Match/)

const match = { id: 'fm-1', friendly_match_code: 'FRM001', title: 'Sunday Smash', description: 'Friendly league', creator_player_id: 'p1', event_type: 'SINGLES', format: 'LEAGUE', max_players: 8, status: 'OPEN', created_at: '2026-09-13', updated_at: '2026-09-13', participant_count: '3', isCreator: false, isParticipant: false, hasPendingJoinRequest: false, canJoin: true }
const secondMatch = { ...match, id: 'fm-2', friendly_match_code: 'FRM002', title: 'Doubles Night', event_type: 'DOUBLES', format: 'KNOCKOUT' }
const homeClient = new QueryClient(); homeClient.setQueryData(['friendly-matches'], [match, secondMatch])
const home = renderToStaticMarkup(<QueryClientProvider client={homeClient}><MemoryRouter><FriendlyHomePage /></MemoryRouter></QueryClientProvider>)
assert.match(home, /Create Friendly Match/); assert.match(home, /Available Friendly Matches/); assert.match(home, /Sunday Smash/); assert.match(home, /Doubles Night/); assert.doesNotMatch(home, /Browse Friendly Matches/)
assert.match(home, /href="\/player\/friendly-matches\/fm-1"/)
const loadingHome = renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><MemoryRouter><FriendlyHomePage /></MemoryRouter></QueryClientProvider>)
assert.match(loadingHome, /Loading Friendly Matches/); assert.match(loadingHome, /Create Friendly Match/)
const emptyClient = new QueryClient(); emptyClient.setQueryData(['friendly-matches'], [])
assert.match(renderToStaticMarkup(<QueryClientProvider client={emptyClient}><MemoryRouter><FriendlyHomePage /></MemoryRouter></QueryClientProvider>), /No Friendly Matches available yet/)
const errorHome = renderToStaticMarkup(<MemoryRouter><FriendlyMatchListContent loading={false} failed matches={undefined} onRetry={() => {}} /></MemoryRouter>)
assert.match(errorHome, /Unable to load Friendly Matches/); assert.match(errorHome, /Retry/)
const card = renderToStaticMarkup(<MemoryRouter><FriendlyMatchCard match={match} /></MemoryRouter>)
assert.match(card, /Sunday Smash/); assert.match(card, /Join Friendly Match/)
const browseClient = new QueryClient(); browseClient.setQueryData(['friendly-matches'], [match])
const browse = renderToStaticMarkup(<QueryClientProvider client={browseClient}><MemoryRouter><FriendlyBrowsePage /></MemoryRouter></QueryClientProvider>)
assert.match(browse, /Friendly Matches/); assert.match(browse, /Sunday Smash/)
const detailClient = new QueryClient(); detailClient.setQueryData(['friendly-matches', 'fm-1'], match)
const details = renderToStaticMarkup(<QueryClientProvider client={detailClient}><MemoryRouter initialEntries={['/player/friendly-matches/fm-1']}><Routes><Route path="/player/friendly-matches/:id" element={<FriendlyDetailsPage />} /></Routes></MemoryRouter></QueryClientProvider>)
assert.match(details, /Sunday Smash/); assert.match(details, /FRM001/); assert.match(details, /Join Friendly Match/)
for (const [state, label] of [[{ ...match, isCreator: true }, 'You created this Friendly Match'], [{ ...match, isParticipant: true }, 'Already participating'], [{ ...match, hasPendingJoinRequest: true }, 'Join request pending']] as const) {
  assert.equal(friendlyUserLabel(state), label)
  const html = renderToStaticMarkup(<FriendlyUserAction match={state} />)
  assert.match(html, new RegExp(label)); assert.doesNotMatch(html, />Join Friendly Match</)
}

const originalGet = apiClient.get; const originalPost = apiClient.post
const calls: Array<{ path: string; body?: unknown }> = []
apiClient.get = async path => { calls.push({ path }); return { data: path === '/api/friendly-matches' ? [match] : match } as never }
apiClient.post = async (path, body) => { calls.push({ path, body }); return { data: path.endsWith('/join') ? { id: 'join-1', friendly_match_id: 'fm-1', player_id: 'p2', status: 'PENDING', created_at: '', updated_at: '' } : match } as never }
try {
  assert.equal((await friendlyService.getFriendlyMatches())[0].id, 'fm-1')
  assert.equal((await friendlyService.getFriendlyMatch('fm-1')).title, 'Sunday Smash')
  const created = await friendlyService.createFriendlyMatch(base); assert.equal(created.id, 'fm-1')
  const createCall = calls.find(call => call.path === '/api/friendly-matches' && call.body)
  assert.deepEqual(createCall?.body, base); assert.equal(Object.prototype.hasOwnProperty.call(createCall?.body ?? {}, 'creatorPlayerId'), false)
  const joined = await friendlyService.joinFriendlyMatch('fm-1'); assert.equal(joined.status, 'PENDING')
  assert.deepEqual(calls.find(call => call.path.endsWith('/join'))?.body, {})
} finally { apiClient.get = originalGet; apiClient.post = originalPost }
const invalidated: string[] = []
await invalidateFriendlyAfterJoin({ invalidateQueries: async ({ queryKey }) => { invalidated.push(queryKey.join('/')) } } as never, 'fm-1')
assert.deepEqual(invalidated.sort(), ['friendly-matches', 'friendly-matches/fm-1'])
console.log('PASS: Friendly direct-list home, loading/empty/error states, browse compatibility, validation, user-state UI and exact APIs')
