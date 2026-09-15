import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import apiClient from '../src/api/apiClient'
import { FriendlyLifecycleActions, FriendlyLifecycleConfirmDialog, friendlyLifecycleAction } from '../src/features/friendly/components/FriendlyLifecycleActions'
import { FriendlyResultsSection } from '../src/features/friendly/components/FriendlyResults'
import { FriendlyFixtureView } from '../src/features/friendly/components/FriendlyFixtures'
import { friendlyKeys } from '../src/features/friendly/hooks/friendlyHooks'
import { friendlyService } from '../src/features/friendly/services/friendlyService'
import { canShowFriendlyJoinRequests } from '../src/features/friendly/pages/FriendlyDetailsPage'
import type { FriendlyMatch, FriendlyMatchStatus, FriendlyResult } from '../src/features/friendly/types/friendly.types'

for (const status of ['DRAFT', 'OPEN', 'ACTIVE', 'DELETED'] as FriendlyMatchStatus[]) {
  assert.equal(friendlyLifecycleAction(status, true), null)
  assert.equal(friendlyLifecycleAction(status, false), null)
}
assert.equal(friendlyLifecycleAction('COMPLETED', true), 'CLOSE')
assert.equal(friendlyLifecycleAction('CLEANUP_PENDING', true), 'CLEANUP')
assert.equal(friendlyLifecycleAction('COMPLETED', false), null)
assert.equal(friendlyLifecycleAction('CLEANUP_PENDING', false), null)
assert.equal(canShowFriendlyJoinRequests(true, 'DRAFT'), true)
assert.equal(canShowFriendlyJoinRequests(true, 'OPEN'), true)
for (const status of ['ACTIVE', 'COMPLETED', 'CLEANUP_PENDING', 'DELETED']) assert.equal(canShowFriendlyJoinRequests(true, status), false)
assert.equal(canShowFriendlyJoinRequests(false, 'OPEN'), false)

const match: FriendlyMatch = { id: 'f1', friendly_match_code: 'FRN001', title: 'Sunday Smash', description: null, creator_player_id: 'p1', event_type: 'SINGLES', format: 'KNOCKOUT', max_players: 4, status: 'COMPLETED', created_at: '', updated_at: '', isCreator: true, isParticipant: true, hasPendingJoinRequest: false, canJoin: false }
const wrap = (node: React.ReactNode, client = new QueryClient()) => renderToStaticMarkup(<MemoryRouter><QueryClientProvider client={client}>{node}</QueryClientProvider></MemoryRouter>)
assert.match(wrap(<FriendlyLifecycleActions match={match} />), /Close Friendly Match/)
assert.doesNotMatch(wrap(<FriendlyLifecycleActions match={{ ...match, isCreator: false }} />), /Close Friendly Match|Cleanup Friendly Data/)
const cleanupHtml = wrap(<FriendlyLifecycleActions match={{ ...match, status: 'CLEANUP_PENDING' }} />)
assert.match(cleanupHtml, /Friendly Match closed/); assert.match(cleanupHtml, /Cleanup pending/); assert.match(cleanupHtml, /Cleanup Friendly Data/); assert.doesNotMatch(cleanupHtml, /Close Friendly Match/)
assert.doesNotMatch(wrap(<FriendlyLifecycleActions match={{ ...match, status: 'CLEANUP_PENDING', isCreator: false }} />), /Cleanup Friendly Data/)

const closeDialog = renderToStaticMarkup(<FriendlyLifecycleConfirmDialog kind="CLOSE" busy={false} onCancel={() => {}} onConfirm={() => {}} />)
assert.match(closeDialog, /role="dialog"/); assert.match(closeDialog, /Close this Friendly Match/); assert.match(closeDialog, /final result will remain available/); assert.match(closeDialog, /cleanup-pending state/); assert.match(closeDialog, /Confirm Close/)
const cleanupDialog = renderToStaticMarkup(<FriendlyLifecycleConfirmDialog kind="CLEANUP" busy={false} onCancel={() => {}} onConfirm={() => {}} />)
assert.match(cleanupDialog, /Cleanup Friendly Data/); assert.match(cleanupDialog, /operational data/); assert.match(cleanupDialog, /Player accounts, profiles, and official tournament history are not deleted/); assert.match(cleanupDialog, /Confirm Cleanup/)
assert.match(renderToStaticMarkup(<FriendlyLifecycleConfirmDialog kind="CLOSE" busy={true} onCancel={() => {}} onConfirm={() => {}} />), /Closing\.\.\./)
assert.match(renderToStaticMarkup(<FriendlyLifecycleConfirmDialog kind="CLEANUP" busy={true} onCancel={() => {}} onConfirm={() => {}} />), /Cleaning up\.\.\./)

const result: FriendlyResult = { friendlyMatchId: 'f1', eventType: 'SINGLES', format: 'KNOCKOUT', status: 'CLEANUP_PENDING', winner: { participantId: 'p1', participantType: 'PLAYER' }, runnerUp: { participantId: 'p2', participantType: 'PLAYER' }, winnerScore: 21, runnerUpScore: 18 }
const client = new QueryClient(); client.setQueryData(friendlyKeys.result('f1'), result); client.setQueryData(friendlyKeys.participants('f1'), [{ id: 'r1', friendly_match_id: 'f1', player_id: 'p1', created_at: '', full_name: 'Arun', player_code: 'P1' }, { id: 'r2', friendly_match_id: 'f1', player_id: 'p2', created_at: '', full_name: 'Bala', player_code: 'P2' }])
const retained = wrap(<FriendlyResultsSection match={{ ...match, status: 'CLEANUP_PENDING' }} />, client)
assert.match(retained, /Winner/); assert.match(retained, /Arun/); assert.match(retained, /Runner-up/); assert.match(retained, /Bala/)

const fixture = { fixture: { id: 'fx', friendly_match_id: 'f1', fixture_code: 'FX', format: 'KNOCKOUT' as const, status: 'PUBLISHED' as const, created_at: '', updated_at: '' }, matches: [{ id: 'm1', friendly_match_id: 'f1', fixture_id: 'fx', match_code: 'M1', round_number: 1, match_number: 1, status: 'LIVE' as const, participant1_id: 'p1', participant1_type: 'PLAYER' as const, participant2_id: 'p2', participant2_type: 'PLAYER' as const, participant1_score: 10, participant2_score: 8, winning_points: 15, source_match_1_id: null, source_match_2_id: null, next_match_id: null, next_match_slot: null, started_at: '', completed_at: null, created_at: '', updated_at: '' }] }
const readOnlyFixture = wrap(<FriendlyFixtureView data={fixture} participants={client.getQueryData(friendlyKeys.participants('f1')) ?? []} teams={[]} isCreator={false} />)
assert.doesNotMatch(readOnlyFixture, /Start Match|Increment|Decrement|Complete Match/)

const originalPost = apiClient.post; const calls: Array<{ path: string; body: unknown }> = []
apiClient.post = async (path, body) => { calls.push({ path, body }); return { data: path.endsWith('/close') ? { ...match, status: 'CLEANUP_PENDING' } : {} } as never }
try { await friendlyService.closeFriendlyMatch('f1'); await friendlyService.closeFriendlyMatch('f1'); await friendlyService.cleanupFriendlyMatch('f1'); await friendlyService.cleanupFriendlyMatch('f1') } finally { apiClient.post = originalPost }
assert.deepEqual(calls[0], { path: '/api/friendly-matches/f1/close', body: {} }); assert.deepEqual(calls[1], calls[0])
assert.deepEqual(calls[2], { path: '/api/friendly-matches/f1/cleanup', body: {} }); assert.deepEqual(calls[3], calls[2])

const hooksSource = await readFile('src/features/friendly/hooks/friendlyHooks.ts', 'utf8')
for (const key of ['detail', 'joinRequests', 'participants', 'teams', 'fixtures', 'result', 'standings']) assert.match(hooksSource, new RegExp(`friendlyKeys\\.${key}\\(friendlyId\\)`))
const pageSource = await readFile('src/features/friendly/pages/FriendlyDetailsPage.tsx', 'utf8')
assert.match(pageSource, /canShowJoinRequests && <FriendlyJoinRequests/); assert.match(pageSource, /operational && canShowTeamSetup/)
assert.doesNotMatch(pageSource, /<FriendlyLifecycleActions match=/)
const resultsSource = await readFile('src/features/friendly/components/FriendlyResults.tsx', 'utf8'); assert.match(resultsSource, /<FriendlyLifecycleActions match={match}/)
const lifecycleSource = await readFile('src/features/friendly/components/FriendlyLifecycleActions.tsx', 'utf8')
assert.match(lifecycleSource, /navigate\('\/player\/friendly-matches'/); assert.match(lifecycleSource, /role="alert"/); assert.doesNotMatch(lifecycleSource, /cleanupFriendlyMatch.*closeFriendlyMatch|closeFriendlyMatch.*cleanupFriendlyMatch/)
console.log('PASS: 60 Friendly lifecycle and composition assertions for visibility, contextual actions, confirmations, exact APIs, retained result, cache cleanup and navigation')
