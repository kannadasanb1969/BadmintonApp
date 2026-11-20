import { Link, useNavigate } from 'react-router-dom'
import { isExplicitMockApiMode } from '@/api/apiClient'
import { AppIcon } from '@/components/mobile/MobileAppShell'
import { isTournamentCompleted, TournamentCardResults } from '@/features/player/components/TournamentCardResults'
import { useResultStore } from '@/features/fixtures/store/resultStore'
import { createDoublesFixtureDemo } from '@/features/tournaments/services/demoTournamentService'
import { useTournamentStore } from '@/features/tournaments/store/tournamentStore'
import { formatDateDisplay, getStatusLabel } from '@/features/tournaments/utils/tournamentHelpers'
import { useAuthStore } from '@/store/authStore'

const OrganizerDashboard = () => {
  const user = useAuthStore(state => state.user)
  const tournaments = useTournamentStore(state => state.tournaments)
  const loading = useTournamentStore(state => state.loading)
  const error = useTournamentStore(state => state.error)
  const results = useResultStore(state => state.results)
  const navigate = useNavigate()
  const owned = tournaments.filter(item => item.organizerId === user?.id)
  const stats = [
    ['Tournaments', owned.length],
    ['Published', owned.filter(item => item.status === 'PUBLISHED').length],
    ['Completed', owned.filter(item => isTournamentCompleted(item, results)).length],
    ['Drafts', owned.filter(item => item.status === 'DRAFT').length],
  ] as const

  return <div className="organizer-home">
    <header className="organizer-home-hero">
      <h1>Your tournaments</h1>
      <p>Manage tournaments, registrations, fixtures and live scores.</p>
      <dl>{stats.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </header>
    <div className="organizer-home-actions">
      <div className="organizer-create-card">
        <div><h2>Create tournament</h2><p>Start a new badminton event</p></div>
        <Link to="/organizer/tournaments/new"><AppIcon name="plus" /> Create</Link>
      </div>
      <Link className="organizer-notice workspace-white-card" to="/organizer/notifications">
        <AppIcon name="bell" /><div><strong>Notifications</strong><p>View organizer updates</p></div><span aria-hidden="true">›</span>
      </Link>
    </div>
    {isExplicitMockApiMode && <button type="button" className="mobile-secondary-button" onClick={async () => {
      if (!user) return
      const id = await createDoublesFixtureDemo(user)
      navigate(`/organizer/tournaments/${id}`)
    }}>Create 16-team doubles test tournament</button>}
    <section>
      <div className="workspace-section-heading"><h2>My tournaments</h2><Link to="/organizer/tournaments">Manage tournaments ›</Link></div>
      {loading && <p role="status">Loading tournaments…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && owned.length === 0 && <div className="workspace-white-card">
        <strong>No tournaments yet</strong><p>Create your first tournament and start organizing matches.</p>
        <Link to="/organizer/tournaments/new">Create tournament ›</Link>
      </div>}
      <div className="organizer-home-list">
        {owned.map(item => {
          const completed = isTournamentCompleted(item, results)
          const status = getStatusLabel(item.status)
          return <article className="workspace-white-card organizer-tournament-card" key={item.id}>
            <div><span className={`organizer-event-status ${status.color}`}>{completed ? 'Completed' : status.label}</span><small>{formatDateDisplay(item.tournamentDate)}</small></div>
            <h3>{item.name}</h3>
            {completed && <TournamentCardResults tournament={item} results={results} />}
            <footer><span>Badminton tournament</span><Link to={'/organizer/tournaments/' + encodeURIComponent(item.id)}>View tournament ›</Link></footer>
          </article>
        })}
      </div>
    </section>
  </div>
}

export default OrganizerDashboard
