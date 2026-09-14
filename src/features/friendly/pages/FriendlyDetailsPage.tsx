import { Link, useLocation, useParams } from 'react-router-dom'
import { ApiError } from '@/api/apiClient'
import { useFriendlyMatch, useJoinFriendlyMatch } from '../hooks/friendlyHooks'
import { FriendlyStatusBadge } from '../components/FriendlyStatusBadge'
import { FriendlyUserAction } from '../components/FriendlyUserAction'
import { participantCount } from '../components/FriendlyMatchCard'
import { FriendlyJoinRequests, FriendlyParticipants } from '../components/FriendlyManagement'
import { FriendlyTeamSetup } from '../components/FriendlyTeamSetup'
import { canShowTeamSetup } from '../utils/friendlyTeams'
import { FriendlyFixturesSection } from '../components/FriendlyFixtures'
import { FriendlyResultsSection } from '../components/FriendlyResults'

export const shouldShowFriendlyManagement = (isCreator: boolean) => isCreator
export const canShowFriendlyJoinRequests = (isCreator: boolean, status: string) => isCreator && (status === 'DRAFT' || status === 'OPEN')

export const FriendlyDetailsPage = () => {
  const { id = '' } = useParams(); const location = useLocation(); const query = useFriendlyMatch(id); const join = useJoinFriendlyMatch(id)
  const success = (location.state as { message?: string } | null)?.message
  if (query.isLoading) return <p className="py-12 text-center">Loading Friendly Match...</p>
  if (query.isError) { const missing = query.error instanceof ApiError && query.error.status === 404; return <div role="alert" className="mx-auto max-w-xl px-4 py-12 text-center"><h1 className="text-2xl font-black">{missing ? 'Friendly Match not found' : 'Unable to load Friendly Match'}</h1>{!missing && <button className="mt-4 font-bold text-emerald-700 underline" onClick={() => query.refetch()}>Retry</button>}</div> }
  const match = query.data; if (!match) return null; const count = participantCount(match.participant_count); const operational = match.status === 'DRAFT' || match.status === 'OPEN' || match.status === 'ACTIVE'; const deleted = match.status === 'DELETED'; const canShowJoinRequests = canShowFriendlyJoinRequests(match.isCreator, match.status)
  const joinNow = async () => { try { await join.mutateAsync(); await query.refetch() } catch { /* rendered below */ } }
  return <section className="mobile-app-shell -mx-4 px-4 py-6 sm:mx-0 sm:px-6"><div className="mx-auto max-w-4xl"><Link to="/player/friendly-matches/browse" className="inline-flex min-h-11 items-center font-bold text-emerald-700">← Browse Friendly Matches</Link><article className="player-dashboard-hero mt-3"><div className="relative z-10"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p>Friendly Match</p><h1 className="break-words">{match.title}</h1><span>{match.friendly_match_code}</span></div><FriendlyStatusBadge status={match.status} /></div>{match.description && <span className="mt-5 max-w-2xl break-words">{match.description}</span>}<dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Event', match.event_type], ['Format', match.format], ['Capacity', match.max_players], ['Participants', count]].filter(([, value]) => value !== null).map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/10 p-3"><dt className="text-xs text-emerald-200">{label}</dt><dd className="mt-1 font-black text-white">{value}</dd></div>)}</dl></div></article>{success && <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">{success}</p>}<div className="mt-4"><FriendlyUserAction match={match} joining={join.isPending} onJoin={joinNow} />{join.isError && <p role="alert" className="mt-3 text-sm font-semibold text-rose-700">{join.error instanceof Error ? join.error.message : 'Unable to send join request.'}</p>}</div>{!deleted && <div className="mt-5 grid gap-5">{canShowJoinRequests && <FriendlyJoinRequests friendlyId={match.id} />}<FriendlyParticipants friendlyId={match.id} />{operational && canShowTeamSetup(match.event_type, match.isCreator) && <FriendlyTeamSetup friendlyId={match.id} />}<FriendlyFixturesSection match={match} /><FriendlyResultsSection match={match} /></div>}</div></section>
}
