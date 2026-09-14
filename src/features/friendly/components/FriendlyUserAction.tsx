import type { FriendlyMatch } from '@/features/friendly/types/friendly.types'
import { Link } from 'react-router-dom'

export const friendlyUserLabel = (match: Pick<FriendlyMatch, 'isCreator' | 'isParticipant' | 'hasPendingJoinRequest' | 'canJoin'>) =>
  match.isCreator ? 'You created this Friendly Match' : match.isParticipant ? 'Already participating' : match.hasPendingJoinRequest ? 'Join request pending' : match.canJoin ? null : 'Joining unavailable'

export const FriendlyUserAction = ({ match, onJoin, joinTo, joining = false }: { match: FriendlyMatch; onJoin?: () => void; joinTo?: string; joining?: boolean }) => {
  const label = friendlyUserLabel(match)
  if (label) return <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{label}</p>
  if (joinTo) return <Link to={joinTo} className="inline-flex w-full justify-center rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white sm:w-auto">Join Friendly Match</Link>
  return <button type="button" disabled={joining} onClick={onJoin} className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white disabled:opacity-60 sm:w-auto">{joining ? 'Sending request...' : 'Join Friendly Match'}</button>
}
