import { ApiError } from '@/api/apiClient'
import type { FriendlyMatch, FriendlyParticipant, FriendlyResult, FriendlyStandings, FriendlyTeam } from '../types/friendly.types'
import { useFriendlyParticipants, useFriendlyResult, useFriendlyStandings, useFriendlyTeams } from '../hooks/friendlyHooks'
import { resolveFriendlyParticipant } from './FriendlyFixtures'
import { FriendlyLifecycleActions } from './FriendlyLifecycleActions'

const Identity = ({ id, type, participants, teams }: { id: string; type: 'PLAYER' | 'TEAM'; participants: FriendlyParticipant[]; teams: FriendlyTeam[] }) => {
  const display = resolveFriendlyParticipant(id, type, participants, teams)
  return <div className="min-w-0"><p className="break-words font-black">{display.title}</p>{display.subtitle && <p className="break-words text-sm text-slate-600">{display.subtitle}</p>}</div>
}

export const FriendlyKnockoutResultView = ({ match, result, participants, teams }: { match: FriendlyMatch; result: FriendlyResult | null | undefined; participants: FriendlyParticipant[]; teams: FriendlyTeam[] }) => {
  if (!result?.winner || !result.runnerUp) return <p className="text-slate-600">No final result is available.</p>
  return <div>
    <div className="mb-4"><p className="text-sm text-slate-500">{match.title} · {match.friendly_match_code}</p><p className="text-sm font-bold">{result.eventType} · {result.format}</p></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <article className="min-w-0 rounded-xl border-2 border-amber-300 bg-amber-50 p-4"><p className="text-sm font-bold">Winner</p><Identity id={result.winner.participantId} type={result.winner.participantType} participants={participants} teams={teams} />{typeof result.winnerScore === 'number' && <p className="mt-2 text-3xl font-black tabular-nums">{result.winnerScore}</p>}</article>
      <article className="min-w-0 rounded-xl border bg-slate-50 p-4"><p className="text-sm font-bold">Runner-up</p><Identity id={result.runnerUp.participantId} type={result.runnerUp.participantType} participants={participants} teams={teams} />{typeof result.runnerUpScore === 'number' && <p className="mt-2 text-3xl font-black tabular-nums">{result.runnerUpScore}</p>}</article>
    </div>
  </div>
}

export const FriendlyLeagueStandingsView = ({ standings, participants, teams }: { standings: FriendlyStandings; participants: FriendlyParticipant[]; teams: FriendlyTeam[] }) => {
  const leader = standings.provisionalLeader ? resolveFriendlyParticipant(standings.provisionalLeader.participantId, standings.provisionalLeader.participantType, participants, teams) : null
  return <div>
    {standings.rankingStatus === 'TIE_BREAK_REQUIRED' && <p role="status" className="mb-4 rounded-xl bg-amber-50 p-3 font-bold text-amber-900">League result requires a tie-break.</p>}
    {standings.rankingStatus === 'CLEAR_LEADER' && leader && <div className="mb-4 rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4"><p className="text-sm font-bold">Backend leader</p><p className="break-words font-black">{leader.title}</p>{leader.subtitle && <p className="text-sm text-slate-600">{leader.subtitle}</p>}</div>}
    {!standings.allGamesCompleted && <p className="mb-4 text-slate-600">Results will be available after match completion. Current standings:</p>}
    {standings.standings.length === 0 ? <p className="text-slate-600">No standings are available.</p> : <div data-testid="friendly-standings-scroll" className="overflow-x-auto"><table className="w-full min-w-[34rem] border-collapse text-left"><thead><tr className="border-b"><th scope="col" className="p-3">Position</th><th scope="col" className="p-3">Player or Team</th><th scope="col" className="p-3 text-center">Played</th><th scope="col" className="p-3 text-center">Won</th><th scope="col" className="p-3 text-center">Lost</th></tr></thead><tbody>{standings.standings.map(row => <tr key={`${row.participantType}:${row.participantId}`} className="border-b last:border-0"><td className="p-3">{row.position ?? '—'}</td><td className="p-3"><Identity id={row.participantId} type={row.participantType} participants={participants} teams={teams} /></td><td className="p-3 text-center tabular-nums">{row.played}</td><td className="p-3 text-center tabular-nums">{row.won}</td><td className="p-3 text-center tabular-nums">{row.lost}</td></tr>)}</tbody></table></div>}
  </div>
}

export const FriendlyResultsSection = ({ match }: { match: FriendlyMatch }) => {
  const knockout = match.format === 'KNOCKOUT'; const resultAvailable = match.status === 'COMPLETED' || match.status === 'CLEANUP_PENDING'
  const resultQuery = useFriendlyResult(match.id, knockout && resultAvailable)
  const standingsQuery = useFriendlyStandings(match.id, !knockout)
  const participantsQuery = useFriendlyParticipants(match.id); const teamsQuery = useFriendlyTeams(match.id, match.event_type === 'DOUBLES')
  const activeQuery = knockout ? resultQuery : standingsQuery
  let content
  if (knockout && !resultAvailable) content = <p className="text-slate-600">Results will be available after match completion.</p>
  else if (activeQuery.isLoading || participantsQuery.isLoading || teamsQuery.isLoading) content = <p>Loading Friendly results...</p>
  else if (activeQuery.isError) {
    const empty = activeQuery.error instanceof ApiError && activeQuery.error.status === 404
    content = empty ? <p className="text-slate-600">No result is available.</p> : <div><p role="alert" className="text-rose-700">Unable to load Friendly results.</p><button onClick={() => activeQuery.refetch()} className="mt-2 font-bold text-emerald-700 underline">Retry</button></div>
  } else if (knockout) content = <FriendlyKnockoutResultView match={match} result={resultQuery.data} participants={participantsQuery.data ?? []} teams={teamsQuery.data ?? []} />
  else if (standingsQuery.data) content = <FriendlyLeagueStandingsView standings={standingsQuery.data} participants={participantsQuery.data ?? []} teams={teamsQuery.data ?? []} />
  else content = <p className="text-slate-600">No standings are available.</p>
  return <section className="mobile-card rounded-3xl border-slate-200 p-5 sm:p-6"><div className="mb-4 flex items-center gap-3"><span aria-hidden="true" className="h-8 w-1 rounded-full bg-emerald-500" /><h2 className="text-xl font-black">Results</h2></div>{content}<FriendlyLifecycleActions match={match} /></section>
}
