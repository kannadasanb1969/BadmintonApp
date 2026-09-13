import { Link } from 'react-router-dom'
import { FriendlyStatusBadge } from './FriendlyStatusBadge'
import { FriendlyUserAction } from './FriendlyUserAction'
import type { FriendlyMatch } from '../types/friendly.types'

export const participantCount = (value?: number | string) => { const count = Number(value); return Number.isFinite(count) && count >= 0 ? count : null }

export const FriendlyMatchCard = ({ match }: { match: FriendlyMatch }) => {
  const count = participantCount(match.participant_count)
  return <article className="min-w-0 rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words text-lg font-black text-slate-900">{match.title}</h2><p className="mt-1 text-xs font-semibold text-slate-500">{match.friendly_match_code}</p></div><FriendlyStatusBadge status={match.status} /></div>
    {match.description && <p className="mt-3 break-words text-sm text-slate-600">{match.description}</p>}
    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-slate-500">Event</dt><dd className="font-bold">{match.event_type}</dd></div><div><dt className="text-slate-500">Format</dt><dd className="font-bold">{match.format}</dd></div><div><dt className="text-slate-500">Capacity</dt><dd className="font-bold">{match.max_players} players</dd></div>{count !== null && <div><dt className="text-slate-500">Participants</dt><dd className="font-bold">{count}</dd></div>}</dl>
    <div className="mt-4"><FriendlyUserAction match={match} joinTo={`/player/friendly-matches/${match.id}`} /></div>
    <Link to={`/player/friendly-matches/${match.id}`} className="mt-4 inline-flex font-bold text-emerald-700">View details →</Link>
  </article>
}
