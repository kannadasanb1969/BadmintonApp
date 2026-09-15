import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import apiClient from '../src/api/apiClient'
import { JoinRequestsContent, ParticipantsContent } from '../src/features/friendly/components/FriendlyManagement'
import { friendlyService } from '../src/features/friendly/services/friendlyService'
import { friendlyKeys, invalidateFriendlyManagement } from '../src/features/friendly/hooks/friendlyHooks'
import { shouldShowFriendlyManagement } from '../src/features/friendly/pages/FriendlyDetailsPage'

const pending = { id: 'request-1', friendly_match_id: 'friendly-1', player_id: 'player-2', status: 'PENDING' as const, created_at: '2026-09-13T00:00:00Z', updated_at: '2026-09-13T00:00:00Z', full_name: 'Player Two', player_code: 'PLR002' }
const renderRequests = (rows, actingId?: string) => renderToStaticMarkup(<JoinRequestsContent rows={rows} actingId={actingId} onApprove={() => {}} onReject={() => {}} />)
assert.equal(shouldShowFriendlyManagement(true), true)
assert.equal(shouldShowFriendlyManagement(false), false)
const pendingHtml = renderRequests([pending])
assert.match(pendingHtml, /Player Two/); assert.match(pendingHtml, /PLR002/); assert.match(pendingHtml, />Approve</); assert.match(pendingHtml, />Reject</)
for (const status of ['APPROVED', 'REJECTED', 'CANCELLED'] as const) {
  const html = renderRequests([{ ...pending, status }])
  assert.doesNotMatch(html, />Approve</); assert.doesNotMatch(html, />Reject</)
}
assert.match(renderRequests([]), /No join requests yet/)
assert.match(renderRequests([pending], 'request-1'), /disabled=""/)
const participant = { id: 'participant-1', friendly_match_id: 'friendly-1', player_id: 'player-2', created_at: '2026-09-13T00:00:00Z', full_name: 'Player Two', player_code: 'PLR002' }
const participantsHtml = renderToStaticMarkup(<ParticipantsContent rows={[participant]} />)
assert.match(participantsHtml, /Player Two/); assert.match(participantsHtml, /PLR002/)
assert.match(renderToStaticMarkup(<ParticipantsContent rows={[]} />), /No participants yet/)

const originalGet = apiClient.get; const originalPost = apiClient.post
const calls: Array<{ path: string; body?: unknown }> = []
apiClient.get = async path => { calls.push({ path }); return { data: path.endsWith('/participants') ? [participant] : [pending] } as never }
apiClient.post = async (path, body) => { calls.push({ path, body }); return { data: { ...pending, status: path.endsWith('/approve') ? 'APPROVED' : 'REJECTED' } } as never }
try {
  assert.equal((await friendlyService.getJoinRequests('friendly-1'))[0].full_name, 'Player Two')
  assert.equal((await friendlyService.getParticipants('friendly-1'))[0].player_code, 'PLR002')
  assert.equal((await friendlyService.approveJoinRequest('friendly-1', 'request-1')).status, 'APPROVED')
  assert.equal((await friendlyService.rejectJoinRequest('friendly-1', 'request-1')).status, 'REJECTED')
  assert.deepEqual(calls.find(call => call.path.endsWith('/approve'))?.body, {})
  assert.deepEqual(calls.find(call => call.path.endsWith('/reject'))?.body, {})
  assert.match(calls.find(call => call.path.endsWith('/approve'))?.path ?? '', /friendly-1\/join-requests\/request-1\/approve$/)
} finally { apiClient.get = originalGet; apiClient.post = originalPost }

const invalidated: string[] = []
await invalidateFriendlyManagement({ invalidateQueries: async ({ queryKey }) => { invalidated.push(queryKey.join('/')) } } as never, 'friendly-1')
assert.deepEqual(invalidated.sort(), [friendlyKeys.all.join('/'), friendlyKeys.detail('friendly-1').join('/'), friendlyKeys.joinRequests('friendly-1').join('/'), friendlyKeys.participants('friendly-1').join('/')].sort())
console.log('PASS: Friendly creator guard, request/participant rows, exact decision APIs and authoritative query invalidation')
