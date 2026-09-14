import PlayerRegistrationsView from '@/features/player/components/PlayerRegistrationsView'
import { tournamentService } from '@/features/tournaments/services/tournamentService'
import { filterPlayerTournaments, tournamentListStatus, TournamentListStatus } from '@/features/player/utils/tournamentListFilters'
import { useResultStore } from '@/features/fixtures/store/resultStore'
import { resultService } from '@/features/results/services/resultService'
import { TournamentCardResults } from '@/features/player/components/TournamentCardResults'
import { useTournamentStore } from '@/features/tournaments/store/tournamentStore'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { displayRegistrationCount, formatDateDisplay, formatTimeDisplay } from '@/features/tournaments/utils/tournamentHelpers'
import tournamentHero from '@/assets/playinfo.png'
import tournamentCardCourt from '@/assets/ref1.png'
import tournamentCardPlayer from '@/assets/ref2.png'
import tournamentCardShuttle from '@/assets/ref3.png'

const PlayerTournamentListPage = () => {
  const { tournaments, loading, error } = useTournamentStore()
  const navigate = useNavigate()
  const results = useResultStore(state => state.results)
  const [resultsError, setResultsError] = useState(false)
  const [query, setQuery] = useState('')
  const [eventType, setEventType] = useState<'ALL' | 'SINGLES' | 'DOUBLES'>('ALL')
  const [searchParams, setSearchParams] = useSearchParams()
  type TournamentView = TournamentListStatus | 'MY_REGISTRATIONS'
  const viewValues: Record<string, TournamentView> = { closed: 'CLOSED', completed: 'COMPLETED', registrations: 'MY_REGISTRATIONS', all: 'ALL' }
  const status = viewValues[searchParams.get('view') ?? ''] ?? 'OPEN'
  const isMyRegistrations = status === 'MY_REGISTRATIONS'
  const setStatus = (next: TournamentView) => {
    const params = new URLSearchParams(searchParams)
    if (next === 'OPEN') params.delete('view')
    else params.set('view', next === 'MY_REGISTRATIONS' ? 'registrations' : next.toLowerCase())
    setSearchParams(params)
  }

  useEffect(() => {
    if (isMyRegistrations) return
    let active = true
    let refreshing = false
    const refresh = async () => {
      if (refreshing || document.visibilityState === 'hidden') return
      refreshing = true
      try {
        const latest = await tournamentService.getTournaments()
        // Older servers can still use the bulk result fallback.
        if (latest.some(tournament => tournament.completionStatus === undefined)) await resultService.getResults()
        if (active) setResultsError(false)
      } catch {
        if (active) setResultsError(true)
      } finally { refreshing = false }
    }
    void refresh()
    const interval = window.setInterval(() => { void refresh() }, 10000)
    const onFocus = () => { void refresh() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [isMyRegistrations])

  const publishedTournaments = useMemo(() => filterPlayerTournaments(tournaments, results, query, eventType, isMyRegistrations ? 'ALL' : status),
    [tournaments, results, query, eventType, status])
  const statusColor = { OPEN: 'bg-emerald-50 text-emerald-700', CLOSED: 'bg-rose-50 text-rose-700', COMPLETED: 'bg-blue-50 text-blue-700', ALL: 'bg-slate-50 text-slate-700', MY_REGISTRATIONS: 'bg-emerald-50 text-emerald-700' }
  const emptyMessage = { OPEN: 'No open registration tournaments found.', CLOSED: 'No registration-closed tournaments found.', COMPLETED: 'No completed tournaments found.', ALL: 'No matching tournaments found.', MY_REGISTRATIONS: 'No matching registrations found.' }

  if (loading && !isMyRegistrations) {
    return <div className="text-center py-8">Loading tournaments...</div>
  }

  if (error && !isMyRegistrations) {
    return <div className="text-center py-8 text-red-500">Error loading tournaments: {error}</div>
  }


  return (
    <div className="player-tournament-page -mx-0 space-y-6 px-4 py-5 sm:px-6 sm:py-8">
      <section className="tournament-reference-hero overflow-hidden rounded-2xl p-6 text-white sm:p-8" style={{ backgroundImage: `linear-gradient(90deg, rgb(2 17 20 / .9), rgb(2 17 20 / .38)), url(${tournamentHero})` }}>
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-lime-300">{isMyRegistrations ? 'MY MATCH PASS' : 'FIND YOUR NEXT RALLY'}</p>
        <h1 className="mt-2 max-w-md text-4xl font-black leading-[.98] tracking-tight sm:text-5xl">{isMyRegistrations ? 'My registrations' : <>Tournaments<br /><span>near you</span></>}</h1>
        <p className="mt-4 max-w-md text-base leading-6 text-slate-200">{isMyRegistrations ? 'Your tournament entries, fixtures and match access.' : 'Browse open events, choose your category, and reserve your place on court.'}</p>
      </section>
      <section className="tournament-reference-filters rounded-2xl border p-4 shadow-sm sm:p-5">
        <label className="tournament-search-field"><span aria-hidden="true">⌕</span><input aria-label="Search tournaments" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by tournament or venue" /></label>
        <select aria-label="Event type" value={eventType} onChange={(event) => setEventType(event.target.value as typeof eventType)}><option value="ALL">All events</option><option value="SINGLES">Singles</option><option value="DOUBLES">Doubles</option></select>
        <label className="tournament-open-filter"><input type="checkbox" checked={status === 'OPEN'} onChange={(event) => setStatus(event.target.checked ? 'OPEN' : 'ALL')} /><span>Open registration only</span></label>
      </section>
      {isMyRegistrations ? <PlayerRegistrationsView query={query} eventType={eventType} /> : <>
      <div className="flex items-center justify-between"><h2 className="text-2xl font-black text-white">{publishedTournaments.length} events found</h2><span className="text-sm text-slate-400">Select an event to register</span></div>
      {publishedTournaments.length === 0 && <div className="player-surface-card rounded-2xl border border-dashed py-14 text-center"><p className="text-lg font-bold text-white">{emptyMessage[status]}</p><p className="mt-2 text-sm text-slate-400">Try changing your search or event filters.</p></div>}
      {resultsError && <p role="status" className="text-sm text-slate-500">Results are temporarily unavailable. You can still browse tournaments.</p>}
      <div className="space-y-4">
        {publishedTournaments.map((tournament, index) => {
          const cardStatus = tournamentListStatus(tournament, results)
          const completed = cardStatus === 'COMPLETED'
          const open = cardStatus === 'OPEN'
          const badge = statusColor[cardStatus]
          return (
          <article key={tournament.id} className="tournament-reference-card rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-lime-300 hover:shadow-lg" style={{ backgroundImage: `linear-gradient(90deg, rgb(2 18 22 / .96), rgb(2 18 22 / .62)), url(${[tournamentCardPlayer, tournamentCardCourt, tournamentCardShuttle][index % 3]})` }}>
            <div className="flex min-w-0 flex-col gap-4">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap gap-2"><span className="tournament-open-badge">{completed ? 'COMPLETED' : open ? 'OPEN NOW' : 'REGISTRATION CLOSED'}</span>{tournament.categories.map(category => <span key={category.id} className="tournament-event-badge">{category.eventType === 'SINGLES' ? 'Singles' : 'Doubles'}</span>)}</div>
                <h2 className="text-xl font-bold text-white">{tournament.name}</h2>
                <p className="mt-2 text-sm text-slate-300">📍 {tournament.venueName} · {formatDateDisplay(tournament.tournamentDate)}</p>
                {completed && <TournamentCardResults tournament={tournament} results={results} />}
                <p className="mt-2 text-sm text-slate-400">Registration closes {formatDateDisplay(tournament.registrationCloseDate)} at {formatTimeDisplay(tournament.registrationCloseTime)}</p>
                <div className="mt-3 flex flex-wrap gap-2"><span className="tournament-info-badge">♟ {displayRegistrationCount(tournament.registeredPlayerCount)} Players Registered</span>{tournament.categories.length > 0 && tournament.categories.every(category => category.eventType === 'DOUBLES') && displayRegistrationCount(tournament.registeredTeamCount) > 0 && <span className="tournament-team-badge">♧ {displayRegistrationCount(tournament.registeredTeamCount)} Teams</span>}</div>
              </div>
              <div className="shrink-0 sm:self-end">
                <button
                  onClick={() => navigate(`/player/tournaments/${tournament.id}`)}
                  className="w-full rounded-xl bg-lime-300 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-lime-200 sm:w-auto"
                >
                  View tournament →
                </button>
              </div>
            </div>
          </article>
        )})}
      </div>
      </>}
    </div>
  )
}

export default PlayerTournamentListPage
