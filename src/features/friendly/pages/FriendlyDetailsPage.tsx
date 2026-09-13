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
import { FriendlyLifecycleActions } from '../components/FriendlyLifecycleActions'

export const shouldShowFriendlyManagement = (isCreator: boolean) => isCreator

export const FriendlyDetailsPage = () => {
  const { id = '' } = useParams(); const location = useLocation(); const query = useFriendlyMatch(id); const join = useJoinFriendlyMatch(id)
  const success = (location.state as { message?: string } | null)?.message
  if (query.isLoading) return <p className="py-12 text-center">Loading Friendly Match...</p>
  if (query.isError) { const missing = query.error instanceof ApiError && query.error.status === 404; return <div role="alert" className="mx-auto max-w-xl px-4 py-12 text-center"><h1 className="text-2xl font-black">{missing ? 'Friendly Match not found' : 'Unable to load Friendly Match'}</h1>{!missing && <button className="mt-4 font-bold text-emerald-700 underline" onClick={() => query.refetch()}>Retry</button>}</div> }
  const match = query.data; if (!match) return null; const count = participantCount(match.participant_count); const operational = match.status === 'DRAFT' || match.status === 'OPEN' || match.status === 'ACTIVE'
  const joinNow = async () => { try { await join.mutateAsync(); await query.refetch() } catch { /* rendered below */ } }
  return <section className="mx-auto max-w-3xl px-4 py-6 sm:px-6"><Link to="/player/friendly-matches/browse" className="font-bold text-emerald-700">← Browse</Link><article className="mt-4 rounded-2xl border bg-white p-5 shadow-sm sm:p-8"><div className="flex flex-wrap justify-between gap-3"><div><h1 className="break-words text-3xl font-black">{match.title}</h1><p className="mt-1 text-sm text-slate-500">{match.friendly_match_code}</p></div><FriendlyStatusBadge status={match.status} /></div>{success && <p className="mt-5 rounded-xl bg-emerald-50 p-3 text-emerald-800">{success}</p>}{match.description && <p className="mt-5 break-words text-slate-600">{match.description}</p>}<dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4"><div><dt className="text-sm text-slate-500">Event</dt><dd className="font-bold">{match.event_type}</dd></div><div><dt className="text-sm text-slate-500">Format</dt><dd className="font-bold">{match.format}</dd></div><div><dt className="text-sm text-slate-500">Capacity</dt><dd className="font-bold">{match.max_players}</dd></div>{count !== null && <div><dt className="text-sm text-slate-500">Participants</dt><dd className="font-bold">{count}</dd></div>}</dl><div className="mt-7"><FriendlyUserAction match={match} joining={join.isPending} onJoin={joinNow} />{join.isError && <p role="alert" className="mt-3 text-sm font-semibold text-rose-700">{join.error instanceof Error ? join.error.message : 'Unable to send join request.'}</p>}</div></article><div className="mt-5 grid gap-5"><FriendlyLifecycleActions match={match} />{operational && shouldShowFriendlyManagement(match.isCreator) && <FriendlyJoinRequests friendlyId={match.id} />}<FriendlyParticipants friendlyId={match.id} />{operational && canShowTeamSetup(match.event_type, match.isCreator) && <FriendlyTeamSetup friendlyId={match.id} />}<FriendlyFixturesSection match={match} /><FriendlyResultsSection match={match} /></div></section>
}
