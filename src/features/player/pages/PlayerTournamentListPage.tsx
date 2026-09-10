import { useTournamentStore } from '@/features/tournaments/store/tournamentStore'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { displayRegistrationCount, formatDateDisplay, formatTimeDisplay } from '@/features/tournaments/utils/tournamentHelpers'

const PlayerTournamentListPage = () => {
  const { tournaments, loading, error } = useTournamentStore()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [eventType, setEventType] = useState<'ALL' | 'SINGLES' | 'DOUBLES'>('ALL')
  const [showOpenOnly, setShowOpenOnly] = useState(true)

  useEffect(() => {
    // Store already fetches on initialization
  }, [])

  const publishedTournaments = useMemo(() => tournaments
    .filter(t => t.status === 'PUBLISHED')
    .filter(t => !query || [t.name, t.venueName, t.venueAddress].join(' ').toLowerCase().includes(query.toLowerCase()))
    .filter(t => eventType === 'ALL' || t.categories.some(category => category.eventType === eventType))
    .filter(t => !showOpenOnly || t.categories.some(category => category.registrationPhase === 'OPEN')),
    [tournaments, query, eventType, showOpenOnly])

  if (loading) {
    return <div className="text-center py-8">Loading tournaments...</div>
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">Error loading tournaments: {error}</div>
  }

  if (publishedTournaments.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">No tournaments available at the moment.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 to-emerald-900 p-6 text-white sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Find your next rally</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Tournaments near you</h1>
        <p className="mt-2 max-w-xl text-sm text-slate-300">Browse open events, choose your category, and reserve your place on court.</p>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by tournament or venue" className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
          <select value={eventType} onChange={(event) => setEventType(event.target.value as typeof eventType)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium"><option value="ALL">All events</option><option value="SINGLES">Singles</option><option value="DOUBLES">Doubles</option></select>
          <label className="flex items-center gap-2 px-2 text-sm font-medium text-slate-600"><input type="checkbox" checked={showOpenOnly} onChange={(event) => setShowOpenOnly(event.target.checked)} />Open registration only</label>
        </div>
      </section>
      <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-slate-800">{publishedTournaments.length} events found</h2><span className="text-sm text-slate-500">Select an event to register</span></div>
      {publishedTournaments.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center"><p className="text-lg font-bold text-slate-700">No matching tournaments</p><p className="mt-2 text-sm text-slate-500">Try changing your search or event filters.</p></div>}
      <div className="space-y-4">
        {publishedTournaments.map(tournament => (
          <article key={tournament.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg">
            <div className="flex flex-col gap-5 sm:flex-row sm:justify-between sm:items-start">
              <div>
                <div className="mb-3 flex flex-wrap gap-2"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">OPEN NOW</span>{tournament.categories.map(category => <span key={category.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{category.eventType === 'SINGLES' ? 'Singles' : 'Doubles'}</span>)}</div>
                <h2 className="text-xl font-bold text-slate-900">{tournament.name}</h2>
                <p className="mt-2 text-sm text-slate-600">📍 {tournament.venueName} · {formatDateDisplay(tournament.tournamentDate)}</p>
                <p className="mt-2 text-sm text-slate-500">Registration closes {formatDateDisplay(tournament.registrationCloseDate)} at {formatTimeDisplay(tournament.registrationCloseTime)}</p>
                <div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">👥 {displayRegistrationCount(tournament.registeredPlayerCount)} Players Registered</span>{tournament.categories.length > 0 && tournament.categories.every(category => category.eventType === 'DOUBLES') && displayRegistrationCount(tournament.registeredTeamCount) > 0 && <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">🏸 {displayRegistrationCount(tournament.registeredTeamCount)} Teams</span>}</div>
              </div>
              <div className="shrink-0">
                <button
                  onClick={() => navigate(`/player/tournaments/${tournament.id}`)}
                  className="w-full rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-600 sm:w-auto"
                >
                  View tournament →
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

export default PlayerTournamentListPage
