import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { FriendlyMatch, FriendlyMatchStatus } from '../types/friendly.types'
import { useCleanupFriendlyMatch, useCloseFriendlyMatch } from '../hooks/friendlyHooks'

export const friendlyLifecycleAction = (status: FriendlyMatchStatus, isCreator: boolean): 'CLOSE' | 'CLEANUP' | null => {
  if (!isCreator) return null
  if (status === 'COMPLETED') return 'CLOSE'
  if (status === 'CLEANUP_PENDING') return 'CLEANUP'
  return null
}

export const FriendlyLifecycleConfirmDialog = ({ kind, busy, onCancel, onConfirm }: { kind: 'CLOSE' | 'CLEANUP'; busy: boolean; onCancel: () => void; onConfirm: () => void }) => {
  const cleanup = kind === 'CLEANUP'
  return <div role="dialog" aria-modal="true" aria-labelledby="friendly-lifecycle-title" aria-describedby="friendly-lifecycle-description" className="mt-4 rounded-xl border-2 border-slate-300 bg-white p-4 shadow-lg">
    <h3 id="friendly-lifecycle-title" className="text-lg font-black">{cleanup ? 'Cleanup Friendly Data?' : 'Close this Friendly Match?'}</h3>
    <p id="friendly-lifecycle-description" className="mt-2 text-sm text-slate-700">{cleanup ? "Cleanup removes this Friendly Match's operational data. Player accounts, profiles, and official tournament history are not deleted." : 'The final result will remain available, scoring and fixture activity will finish, and the match will move to cleanup-pending state.'}</p>
    <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button disabled={busy} onClick={onCancel} className="min-h-11 rounded-xl border px-4 py-2 font-bold disabled:opacity-50">Cancel</button><button disabled={busy} onClick={onConfirm} className={`min-h-11 rounded-xl px-4 py-2 font-bold text-white disabled:opacity-50 ${cleanup ? 'bg-rose-700' : 'bg-slate-900'}`}>{busy ? (cleanup ? 'Cleaning up...' : 'Closing...') : (cleanup ? 'Confirm Cleanup' : 'Confirm Close')}</button></div>
  </div>
}

export const FriendlyLifecycleActions = ({ match }: { match: FriendlyMatch }) => {
  const navigate = useNavigate(); const close = useCloseFriendlyMatch(match.id); const cleanup = useCleanupFriendlyMatch(match.id)
  const [confirming, setConfirming] = useState<'CLOSE' | 'CLEANUP' | null>(null); const [message, setMessage] = useState<string | null>(null); const [error, setError] = useState<string | null>(null)
  const action = friendlyLifecycleAction(match.status, match.isCreator); const busy = close.isPending || cleanup.isPending
  const submit = async () => { if (!confirming || busy) return; setError(null); setMessage(null); try { if (confirming === 'CLOSE') { await close.mutateAsync(); setConfirming(null); setMessage('Friendly Match closed. Cleanup pending.') } else { await cleanup.mutateAsync(); setConfirming(null); navigate('/player/friendly-matches', { replace: true, state: { message: 'Friendly Match data cleaned up.' } }) } } catch (cause) { setError(cause instanceof Error ? cause.message : `Unable to ${confirming === 'CLOSE' ? 'close' : 'cleanup'} Friendly Match.`) } }
  if (!action && match.status !== 'CLEANUP_PENDING') return null
  return <div className="mt-5 border-t border-slate-200 pt-5">{match.status === 'CLEANUP_PENDING' && <div role="status" className="rounded-xl bg-amber-50 p-3"><p className="font-black">Friendly Match closed</p><p className="text-sm">Cleanup pending</p></div>}{message && <p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-emerald-800">{message}</p>}{error && <p role="alert" className="mt-3 text-sm font-semibold text-rose-700">{error}</p>}{action === 'CLOSE' && <button disabled={busy} onClick={() => setConfirming('CLOSE')} className="mobile-secondary-button mt-3 w-full disabled:opacity-50 sm:w-auto">{close.isPending ? 'Closing...' : 'Close Friendly Match'}</button>}{action === 'CLEANUP' && <button disabled={busy} onClick={() => setConfirming('CLEANUP')} className="mt-3 min-h-12 w-full rounded-xl bg-rose-700 px-5 text-sm font-bold text-white disabled:opacity-50 sm:w-auto">{cleanup.isPending ? 'Cleaning up...' : 'Cleanup Friendly Data'}</button>}{confirming && <FriendlyLifecycleConfirmDialog kind={confirming} busy={busy} onCancel={() => setConfirming(null)} onConfirm={() => void submit()} />}</div>
}
