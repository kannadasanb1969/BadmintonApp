import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayerProfileStore } from '@/features/player/store/playerProfileStore'
import { useRegistrationStore } from '@/features/registrations/store/registrationStore'
import { useFixtureStore } from '@/features/fixtures/store/fixtureStore'
import { useTournamentStore } from '@/features/tournaments/store/tournamentStore'
import { useTeamStore } from '@/features/teams/store/teamStore'
import { usePlayerDirectoryStore } from '@/features/player/store/playerDirectoryStore'
import { useAuthStore } from '@/store/authStore'

const PlayerFixturesPage = () => {
  const navigate = useNavigate()
  const storedProfile = usePlayerProfileStore(state => state.profile)
  const user = useAuthStore(state => state.user)
  const directoryProfile = usePlayerDirectoryStore(state => user ? state.getProfileByMobileExact(user.mobile) : undefined)
  const profile = storedProfile?.mobile === user?.mobile ? storedProfile : directoryProfile ?? storedProfile
  const registrations = useRegistrationStore(state => state.registrations)
  const fixtures = useFixtureStore(state => state.fixtures)
  const tournaments = useTournamentStore(state => state.tournaments)
  const teams = useTeamStore(state => state.teams)

  const playerFixtures = useMemo(() => {
    if (!profile) return []
    const playerRegistrations = registrations.filter(registration => registration.playerId === profile.id && registration.status === 'REGISTERED')
    const playerTeams = teams.filter(team => team.status === 'CONFIRMED' && (team.player1Id === profile.id || team.player2Id === profile.id))
    return fixtures.filter(fixture => fixture.status === 'PUBLISHED' && (playerRegistrations.some(registration => registration.tournamentId === fixture.tournamentId && registration.categoryId === fixture.categoryId) || playerTeams.some(team => team.tournamentId === fixture.tournamentId && team.categoryId === fixture.categoryId)))
  }, [fixtures, profile, registrations, teams])

  if (!profile) return <div className="rounded-2xl bg-white p-8 text-center shadow-sm"><p className="text-lg font-bold">Complete your profile to view fixtures.</p><button onClick={() => navigate('/player/profile')} className="mt-4 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white">Complete profile</button></div>

  return <div className="space-y-6">
    <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 to-emerald-900 p-6 text-white sm:p-8"><p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-300">My match centre</p><h1 className="mt-2 text-3xl font-black">Fixtures & results</h1><p className="mt-2 text-sm text-slate-300">Follow your team’s draw, match status, and scores.</p></section>
    {playerFixtures.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"><p className="text-lg font-bold text-slate-800">No fixtures available yet</p><p className="mt-2 text-sm text-slate-500">Fixtures appear here after your tournament registration closes and the organizer publishes the draw.</p><button onClick={() => navigate('/player/registrations')} className="mt-5 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white">View my registrations</button></div> : playerFixtures.map(fixture => {
      const tournament = tournaments.find(item => item.id === fixture.tournamentId)
      const validMatches = (fixture.matches ?? []).filter(Boolean)
      const rounds = Array.from(new Set(validMatches.map(match => match.roundNumber))).sort((a, b) => a - b)
      const final = validMatches.filter(match => match.roundNumber === Math.max(...rounds)).find(match => match.status === 'COMPLETED' && match.winnerId)
      const winner = final ? (final.participant1?.id === final.winnerId ? final.participant1 : final.participant2) : undefined
      const runnerUp = final ? (final.participant1?.id === final.winnerId ? final.participant2 : final.participant1) : undefined
      return <section key={fixture.id} className="fixture-arena p-5 sm:p-8"><div className="fixture-hero"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-blue-300">{tournament?.name ?? fixture.tournamentCode}</p><h2 className="mt-2 text-3xl font-black">{fixture.categoryName} Fixture</h2><p className="mt-2 text-blue-200">{fixture.status === 'PUBLISHED' ? 'Live draw published' : 'Draft fixture'}</p></div><span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-200">{fixture.participants.length} Teams</span></div>{winner && runnerUp && <div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-5"><p className="text-xs font-bold uppercase tracking-[.18em] text-amber-200">🏆 Winner</p><p className="mt-2 text-xl font-black text-white">{winner.name}</p></div><div className="rounded-2xl border border-slate-300/30 bg-white/10 p-5"><p className="text-xs font-bold uppercase tracking-[.18em] text-slate-300">🥈 Runner-up</p><p className="mt-2 text-xl font-black text-white">{runnerUp.name}</p></div></div>}<div className="mt-7 overflow-x-auto"><div className="fixture-rounds">{rounds.map(round => { const matches = validMatches.filter(match => match.roundNumber === round); return <div key={round} className="fixture-round"><h3>🏆 {matches[0]?.roundName ?? `Round ${round + 1}`}</h3><div className="space-y-4">{matches.map(match => <article key={match.id} className="fixture-match-card rounded-2xl border p-4"><p className="mb-3 text-xs font-bold text-slate-400">{match.matchCode} · {match.status}</p><div className="flex justify-between gap-3 border-b border-slate-100 pb-2"><span className="font-semibold">{match.participant1?.name ?? 'TBD'}</span><strong>{match.participant1Score}</strong></div><div className="flex justify-between gap-3 pt-2"><span className="font-semibold">{match.participant2?.name ?? 'TBD'}</span><strong>{match.participant2Score}</strong></div></article>)}</div></div> })}</div></div></section>
    })}
  </div>
}

export default PlayerFixturesPage
