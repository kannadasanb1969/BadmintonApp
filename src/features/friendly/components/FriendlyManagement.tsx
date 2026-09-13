import { useState } from 'react'
import type { FriendlyJoinRequestRow, FriendlyParticipant } from '../types/friendly.types'
import { useApproveFriendlyJoinRequest, useFriendlyJoinRequests, useFriendlyParticipants, useRejectFriendlyJoinRequest } from '../hooks/friendlyHooks'

const readableDate = (value: string) => Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString() : value

export const JoinRequestsContent = ({ rows, actingId, onApprove, onReject }: { rows: FriendlyJoinRequestRow[]; actingId?: string; onApprove: (id: string) => void; onReject: (id: string) => void }) => {
  if (!rows.length) return <p className="text-sm text-slate-500">No join requests yet.</p>
  return <div className="grid gap-3">{rows.map(row => <article key={row.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="break-words font-bold text-slate-900">{row.full_name}</p><p className="text-xs text-slate-500">{row.player_code} · {readableDate(row.created_at)}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{row.status}</span></div>{row.status === 'PENDING' && <div className="mt-3 flex flex-col gap-2 min-[360px]:flex-row"><button disabled={Boolean(actingId)} onClick={() => onApprove(row.id)} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{actingId === row.id ? 'Working...' : 'Approve'}</button><button disabled={Boolean(actingId)} onClick={() => onReject(row.id)} className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-bold text-rose-700 disabled:opacity-50">Reject</button></div>}</article>)}</div>
}

export const ParticipantsContent = ({ rows }: { rows: FriendlyParticipant[] }) => !rows.length
  ? <p className="text-sm text-slate-500">No participants yet.</p>
  : <div className="grid gap-3 sm:grid-cols-2">{rows.map(row => <article key={row.id} className="min-w-0 rounded-xl border border-slate-200 p-4"><p className="break-words font-bold">{row.full_name}</p><p className="text-xs text-slate-500">{row.player_code}</p><p className="mt-2 text-xs text-slate-500">Joined {readableDate(row.created_at)}</p></article>)}</div>

export const FriendlyJoinRequests = ({ friendlyId }: { friendlyId: string }) => {
  const query = useFriendlyJoinRequests(friendlyId, true); const approve = useApproveFriendlyJoinRequest(friendlyId); const reject = useRejectFriendlyJoinRequest(friendlyId); const [message, setMessage] = useState<string | null>(null)
  const action = async (requestId: string, kind: 'approve' | 'reject') => { if (approve.isPending || reject.isPending) return; if (kind === 'reject' && !window.confirm('Reject this join request?')) return; setMessage(null); try { await (kind === 'approve' ? approve : reject).mutateAsync(requestId); setMessage(kind === 'approve' ? 'Join request approved.' : 'Join request rejected.') } catch { /* mutation error rendered */ } }
  const mutationError = approve.error ?? reject.error
  return <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6"><h2 className="text-xl font-black">Join Requests</h2>{message && <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}{query.isLoading ? <p className="mt-4">Loading join requests...</p> : query.isError ? <p role="alert" className="mt-4 text-rose-700">{query.error instanceof Error ? query.error.message : 'Unable to load join requests.'}</p> : <div className="mt-4"><JoinRequestsContent rows={query.data ?? []} actingId={(approve.isPending || reject.isPending) ? (approve.variables ?? reject.variables) : undefined} onApprove={id => void action(id, 'approve')} onReject={id => void action(id, 'reject')} /></div>}{mutationError && <p role="alert" className="mt-3 text-sm text-rose-700">{mutationError instanceof Error ? mutationError.message : 'Unable to update join request.'}</p>}</section>
}

export const FriendlyParticipants = ({ friendlyId }: { friendlyId: string }) => {
  const query = useFriendlyParticipants(friendlyId)
  return <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6"><h2 className="text-xl font-black">Participants</h2>{query.isLoading ? <p className="mt-4">Loading participants...</p> : query.isError ? <p role="alert" className="mt-4 text-rose-700">{query.error instanceof Error ? query.error.message : 'Unable to load participants.'}</p> : <div className="mt-4"><ParticipantsContent rows={query.data ?? []} /></div>}</section>
}
