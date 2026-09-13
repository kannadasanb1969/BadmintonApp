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
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 to-emerald-900 p-6 text-white sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">{isMyRegistrations ? 'MY MATCH PASS' : 'Find your next rally'}</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{isMyRegistrations ? 'My registrations' : 'Tournaments near you'}</h1>
        <p className="mt-2 max-w-xl text-sm text-slate-300">{isMyRegistrations ? 'Your tournament entries, fixtures and match access.' : 'Browse open events, choose your category, and reserve your place on court.'}</p>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
          <input aria-label="Search tournaments" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by tournament or venue" className="col-span-2 min-w-0 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none md:col-span-1 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
          <select aria-label="Event type" value={eventType} onChange={(event) => setEventType(event.target.value as typeof eventType)} className="min-w-0 w-full rounded-xl border border-slate-200 bg-white px-2 py-3 text-xs font-medium sm:px-4 sm:text-sm"><option value="ALL">All events</option><option value="SINGLES">Singles</option><option value="DOUBLES">Doubles</option></select>
          <select aria-label="Tournament status" value={status} onChange={event => setStatus(event.target.value as TournamentView)} className={`min-w-0 w-full rounded-xl border border-slate-200 px-2 py-3 text-xs font-medium sm:px-4 sm:text-sm ${statusColor[status]}`}>
            <option value="OPEN">Open registration</option>
            <option value="CLOSED">Registration closed</option>
            <option value="COMPLETED">Completed</option>
            <option value="MY_REGISTRATIONS">My registrations</option>
            <option value="ALL">All tournaments</option>
          </select>
        </div>
      </section>
      {isMyRegistrations ? <PlayerRegistrationsView query={query} eventType={eventType} /> : <>
      <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-slate-800">{publishedTournaments.length} events found</h2><span className="text-sm text-slate-500">Select an event to register</span></div>
      {publishedTournaments.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center"><p className="text-lg font-bold text-slate-700">{emptyMessage[status]}</p><p className="mt-2 text-sm text-slate-500">Try changing your search or event filters.</p></div>}
      {resultsError && <p role="status" className="text-sm text-slate-500">Results are temporarily unavailable. You can still browse tournaments.</p>}
      <div className="space-y-4">
        {publishedTournaments.map(tournament => {
          const cardStatus = tournamentListStatus(tournament, results)
          const completed = cardStatus === 'COMPLETED'
          const open = cardStatus === 'OPEN'
          const badge = statusColor[cardStatus]
          return (
          <article key={tournament.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg">
            <div className="flex min-w-0 flex-col gap-4">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${badge}`}>{completed ? 'COMPLETED' : open ? 'OPEN NOW' : 'REGISTRATION CLOSED'}</span>{tournament.categories.map(category => <span key={category.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{category.eventType === 'SINGLES' ? 'Singles' : 'Doubles'}</span>)}</div>
                <h2 className="text-xl font-bold text-slate-900">{tournament.name}</h2>
                <p className="mt-2 text-sm text-slate-600">📍 {tournament.venueName} · {formatDateDisplay(tournament.tournamentDate)}</p>
                {completed && <TournamentCardResults tournament={tournament} results={results} />}
                <p className="mt-2 text-sm text-slate-500">Registration closes {formatDateDisplay(tournament.registrationCloseDate)} at {formatTimeDisplay(tournament.registrationCloseTime)}</p>
                <div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">👥 {displayRegistrationCount(tournament.registeredPlayerCount)} Players Registered</span>{tournament.categories.length > 0 && tournament.categories.every(category => category.eventType === 'DOUBLES') && displayRegistrationCount(tournament.registeredTeamCount) > 0 && <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">🏸 {displayRegistrationCount(tournament.registeredTeamCount)} Teams</span>}</div>
              </div>
              <div className="shrink-0 sm:self-end">
                <button
                  onClick={() => navigate(`/player/tournaments/${tournament.id}`)}
                  className="w-full rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-600 sm:w-auto"
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
