import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import apiClient from '../src/api/apiClient'
import { FriendlyTeamSetup } from '../src/features/friendly/components/FriendlyTeamSetup'
import { ParticipantsContent } from '../src/features/friendly/components/FriendlyManagement'
import { friendlyKeys, invalidateFriendlyTeams } from '../src/features/friendly/hooks/friendlyHooks'
import { friendlyService } from '../src/features/friendly/services/friendlyService'
import { canCreateFriendlyTeamFromUnpaired, canCreateManualPair, canShowTeamSetup, friendlyTeamForParticipant, pairingLockedMessage, selectableFriendlyParticipants, shuffleDisabledReason, unpairedFriendlyParticipants } from '../src/features/friendly/utils/friendlyTeams'

const participants = [
  { id: 'row-1', friendly_match_id: 'friendly-1', player_id: 'player-1', created_at: '', full_name: 'Player One', player_code: 'PLR001' },
  { id: 'row-2', friendly_match_id: 'friendly-1', player_id: 'player-2', created_at: '', full_name: 'Player Two', player_code: 'PLR002' },
  { id: 'row-3', friendly_match_id: 'friendly-1', player_id: 'player-3', created_at: '', full_name: 'Player Three', player_code: 'PLR003' },
  { id: 'row-4', friendly_match_id: 'friendly-1', player_id: 'player-4', created_at: '', full_name: 'Player Four', player_code: 'PLR004' },
]
const team = { id: 'team-1', friendly_match_id: 'friendly-1', team_code: 'TEAM001', created_at: '', updated_at: '', members: [{ id: 'player-1', name: 'Player One', code: 'PLR001' }, { id: 'player-2', name: 'Player Two', code: 'PLR002' }] }
assert.equal(canShowTeamSetup('DOUBLES', true), true)
assert.equal(canShowTeamSetup('DOUBLES', false), false)
assert.equal(canShowTeamSetup('SINGLES', true), false)
assert.deepEqual(unpairedFriendlyParticipants(participants, [team]).map(row => row.player_id), ['player-3', 'player-4'])
assert.equal(friendlyTeamForParticipant('player-1', [team])?.team_code, 'TEAM001')
assert.equal(friendlyTeamForParticipant('player-3', [team]), null)
assert.deepEqual(selectableFriendlyParticipants(participants, [team], 'player-3').map(row => row.player_id), ['player-4'])
assert.equal(canCreateFriendlyTeamFromUnpaired(['player-3', 'player-4'], participants, [team]), true)
assert.equal(canCreateFriendlyTeamFromUnpaired(['player-1', 'player-3'], participants, [team]), false)
assert.equal(canCreateManualPair(['player-3', 'player-4']), true)
assert.equal(canCreateManualPair(['player-3', 'player-3']), false)
assert.match(shuffleDisabledReason(1) ?? '', /even number/)
assert.match(shuffleDisabledReason(0) ?? '', /At least two/)
assert.equal(shuffleDisabledReason(2), null)
assert.match(pairingLockedMessage, /fixtures have already been generated/)
const participantCards = renderToStaticMarkup(<ParticipantsContent rows={participants} teams={[team]} showPairingState />)
assert.match(participantCards, /Player One/); assert.match(participantCards, /PAIRED/); assert.match(participantCards, /TEAM001/)
assert.match(participantCards, /Player Three/); assert.match(participantCards, /UNPAIRED/)

const client = new QueryClient()
client.setQueryData(friendlyKeys.teams('friendly-1'), [team])
client.setQueryData(friendlyKeys.participants('friendly-1'), participants)
const html = renderToStaticMarkup(<QueryClientProvider client={client}><FriendlyTeamSetup friendlyId="friendly-1" /></QueryClientProvider>)
assert.match(html, /Team Setup/); assert.match(html, /TEAM001/); assert.match(html, /Player One/); assert.match(html, /PLR001/)
assert.match(html, /Player Three/); assert.doesNotMatch(html, /No teams created yet/); assert.match(html, /lg:grid-cols-2/)
const pairedOptions = [...html.matchAll(/<option[^>]*value="(player-[^"]+)"/g)].map(match => match[1])
assert.doesNotMatch(pairedOptions.join(','), /player-1|player-2/)

const lockedClient = new QueryClient(); lockedClient.setQueryData(friendlyKeys.teams('locked'), [team]); lockedClient.setQueryData(friendlyKeys.participants('locked'), participants); lockedClient.setQueryData(friendlyKeys.fixtures('locked'), { fixture: { id: 'fx' }, matches: [] })
const lockedHtml = renderToStaticMarkup(<QueryClientProvider client={lockedClient}><FriendlyTeamSetup friendlyId="locked" /></QueryClientProvider>)
assert.match(lockedHtml, /Pairing is locked/); assert.match(lockedHtml, /disabled=""[^>]*>Unpair Team/); assert.match(lockedHtml, /disabled=""[^>]*>Create Team/); assert.match(lockedHtml, /disabled=""[^>]*>Shuffle Remaining/)

assert.deepEqual(unpairedFriendlyParticipants(participants, []).map(row => row.player_id), ['player-1', 'player-2', 'player-3', 'player-4'])

const emptyClient = new QueryClient(); emptyClient.setQueryData(friendlyKeys.teams('empty'), []); emptyClient.setQueryData(friendlyKeys.participants('empty'), [])
const empty = renderToStaticMarkup(<QueryClientProvider client={emptyClient}><FriendlyTeamSetup friendlyId="empty" /></QueryClientProvider>)
assert.match(empty, /No teams created yet/); assert.match(empty, /All participants are paired/); assert.match(empty, /At least two unpaired players/)

const originalGet = apiClient.get; const originalPost = apiClient.post; const originalDelete = apiClient.delete
const calls: Array<{ method: string; path: string; body?: unknown }> = []
apiClient.get = async path => { calls.push({ method: 'GET', path }); return { data: [team] } as never }
apiClient.post = async (path, body) => { calls.push({ method: 'POST', path, body }); return { data: path.endsWith('/shuffle-partners') ? [] : { ...team, members: undefined } } as never }
apiClient.delete = async path => { calls.push({ method: 'DELETE', path }); return { data: {} } as never }
try {
  assert.equal((await friendlyService.getTeams('friendly-1'))[0].team_code, 'TEAM001')
  await friendlyService.createTeam('friendly-1', ['player-3', 'player-4'])
  await friendlyService.deleteTeam('friendly-1', 'team-1')
  await friendlyService.shufflePartners('friendly-1')
  await friendlyService.resetFixtures('friendly-1')
  assert.deepEqual(calls.find(call => call.path.endsWith('/teams') && call.method === 'POST')?.body, { playerIds: ['player-3', 'player-4'] })
  assert.equal(Object.prototype.hasOwnProperty.call(calls.find(call => call.path.endsWith('/teams') && call.method === 'POST')?.body ?? {}, 'id'), false)
  assert.equal(calls.find(call => call.method === 'DELETE')?.path, '/api/friendly-matches/friendly-1/teams/team-1')
  assert.deepEqual(calls.find(call => call.path.endsWith('/shuffle-partners'))?.body, {})
  assert.deepEqual(calls.find(call => call.path.endsWith('/fixtures/reset'))?.body, {})
} finally { apiClient.get = originalGet; apiClient.post = originalPost; apiClient.delete = originalDelete }

const invalidated: string[] = []
await invalidateFriendlyTeams({ invalidateQueries: async ({ queryKey }) => { invalidated.push(queryKey.join('/')) } } as never, 'friendly-1')
assert.deepEqual(invalidated.sort(), [friendlyKeys.all.join('/'), friendlyKeys.detail('friendly-1').join('/'), friendlyKeys.fixtures('friendly-1').join('/'), friendlyKeys.participants('friendly-1').join('/'), friendlyKeys.teams('friendly-1').join('/')].sort())
const setupSource = await readFile('src/features/friendly/components/FriendlyTeamSetup.tsx', 'utf8')
assert.match(setupSource, /text === 'Team not found'/); assert.match(setupSource, /await teamsQuery\.refetch\(\)/); assert.match(setupSource, /if \(refreshed\.isSuccess\) setError\(null\)/)
console.log('PASS: Friendly doubles paired/unpaired badges, dropdown/defensive guards, fixture lock, exact mutations and authoritative refetch keys')
