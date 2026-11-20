import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { queryClient } from '@/api/queryClient'
import { AppIcon } from '@/components/mobile/MobileAppShell'
import { WorkspaceMenu } from '@/features/auth/components/WorkspaceMenu'
import { useFriendlyMatches } from '@/features/friendly/hooks/friendlyHooks'
import { locationParams, PlayerLocationPicker, useDiscoveryLocation } from '@/features/location/CityPicker'
import { usePlayerProfileStore } from '@/features/player/store/playerProfileStore'
import { useRegistrationStore } from '@/features/registrations/store/registrationStore'
import { useTournamentStore } from '@/features/tournaments/store/tournamentStore'
import { tournamentService } from '@/features/tournaments/services/tournamentService'
import { formatDateDisplay } from '@/features/tournaments/utils/tournamentHelpers'
import { useAuthStore } from '@/store/authStore'
import courtImage from '@/assets/mobile-court.webp'
import friendlyImage from '@/assets/mobile-friendly.webp'
import tournamentImage from '@/assets/mobile-tournament.webp'

const filters = ['All', 'Today', 'Tomorrow', 'Doubles', 'Singles'] as const
const actions = [
  { title: 'Find Games', detail: 'Play with other players', icon: 'people', tone: 'green', to: '/player/friendly-matches' },
  { title: 'Tournaments', detail: 'Compete & improve', icon: 'trophy', tone: 'amber', to: '/player/tournaments' },
  { title: 'Book Court', detail: 'Find and book courts', icon: 'calendar', tone: 'blue', to: '/player/courts' },
] as const
const inIndia = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' })

const PlayerDashboard = () => {
  const [filter, setFilter] = useState<(typeof filters)[number]>('All')
  const [editingLocation, setEditingLocation] = useState(false)
  const user = useAuthStore(state => state.user)
  const profile = usePlayerProfileStore(state => state.profile)
  const tournaments = useTournamentStore(state => state.tournaments)
  const registrations = useRegistrationStore(state => state.registrations)
  const location = useDiscoveryLocation(state => state.location)
  const games = useFriendlyMatches()
  const nearby = useQuery({
    queryKey: ['home-nearby-tournaments', user?.id, location],
    queryFn: ({ signal }) => tournamentService.discover({ ...(location ? locationParams(location) : {}), nearby: true, view: 'OPEN', size: 6, page: 1 }, signal),
    enabled: Boolean(user && location), retry: false,
  }, queryClient)

  if (!user) return <p>Please log in.</p>

  const active = profile ? registrations.filter(item => item.playerId === profile.id && ['REGISTERED', 'CONFIRMED'].includes(item.status)) : []
  const open = (location ? nearby.data?.items ?? [] : tournaments).filter(item =>
    item.status === 'PUBLISHED' && item.completionStatus !== 'COMPLETED' && item.categories.some(category =>
      category.registrationPhase === 'OPEN' && !active.some(entry => entry.categoryId === category.id && entry.tournamentId === item.id),
    ),
  )
  const day = inIndia.format(new Date(Date.now() + (filter === 'Tomorrow' ? 86_400_000 : 0)))
  const visibleGames = (games.data ?? []).filter(game => {
    if (game.status !== 'OPEN' && game.status !== 'ACTIVE') return false
    if (filter === 'All') return true
    if (filter === 'Doubles' || filter === 'Singles') return game.event_type === filter.toUpperCase()
    const scheduled = game.scheduled_at || game.scheduledAt || game.start_date || game.startDate
    if (!scheduled) return false
    const start = new Date(scheduled)
    return !Number.isNaN(start.getTime()) && inIndia.format(start) === day
  }).slice(0, 4)
  const city = location && 'city' in location ? location.city.city : ''
  const title = city ? 'Tournaments Near You' : 'Open Tournaments'

  return <div className="player-home">
    <details className="player-home-location" onToggle={event => setEditingLocation(event.currentTarget.open)}>
      <summary>{city || (location ? 'Current location' : 'Choose your location')}</summary>
      {editingLocation && <PlayerLocationPicker />}
    </details>

    <header className="player-home-hero" style={{ backgroundImage: `linear-gradient(90deg, #003c29ed, #00402654), url(${courtImage})` }}>
      <p>LET’S PLAY</p>
      <h1>Find your next game{city ? ' in ' + city : ''}</h1>
      <span>Join matches, play tournaments and book courts easily.</span>
    </header>
    <nav className="player-home-actions" aria-label="Quick actions">
      {actions.map(item => <Link className="mobile-action-tile" data-tone={item.tone} to={item.to} key={item.to}>
        <span className="mobile-action-icon"><AppIcon name={item.icon} /></span>
        <strong>{item.title}</strong><small>{item.detail}</small><span aria-hidden="true" className="mobile-tile-arrow">›</span>
      </Link>)}
    </nav>

    <div className="player-home-sections">
      <section>
        <div className="workspace-section-heading"><h2>Games for You</h2><Link to="/player/friendly-matches">See all ›</Link></div>
        <div className="player-game-filters" aria-label="Filter games">
          {filters.map(value => <button type="button" aria-pressed={filter === value} key={value} onClick={() => setFilter(value)}>{value}</button>)}
        </div>
        <div className="workspace-card-stack">
          {games.isPending && <p className="workspace-white-card" role="status">Loading games…</p>}
          {games.isError && <p className="workspace-white-card" role="alert">Unable to load games. <button type="button" onClick={() => void games.refetch()}>Try again</button></p>}
          {games.isSuccess && visibleGames.length === 0 && <div className="workspace-white-card">
            <strong>{filter === 'All' ? 'Your next game is waiting' : 'No games in this view'}</strong>
            <p>{filter === 'Today' || filter === 'Tomorrow' ? 'Only games with a scheduled play date appear here.' : 'Explore friendly matches or create a game with your friends.'}</p>
            <Link to="/player/friendly-matches">Explore games ›</Link>
          </div>}
          {visibleGames.map(game => <Link className="player-game-card" key={game.id} to={'/player/friendly-matches/' + encodeURIComponent(game.id)}>
            <img src={friendlyImage} alt="" loading="lazy" />
            <div><small>{game.status === 'ACTIVE' ? 'In progress' : 'Friendly Match'}</small><h3>{game.title}</h3>
              <p>{game.event_type === 'DOUBLES' ? 'Doubles' : 'Singles'} · {game.participant_count ?? 0}/{game.max_players} players</p>
              <span>View game ›</span>
            </div>
          </Link>)}
        </div>
      </section>
      <section>
        <div className="workspace-section-heading"><h2>{title}</h2><Link to="/player/tournaments">See all ›</Link></div>
        <div className="workspace-card-stack">
          {location && nearby.isLoading && <p className="workspace-white-card" role="status">Loading tournaments…</p>}
          {location && nearby.error && <p className="workspace-white-card" role="alert">Unable to load tournaments. <button type="button" onClick={() => void nearby.refetch()}>Try again</button></p>}
          {open.length === 0 && (!location || nearby.isSuccess) && <p className="workspace-white-card">No open tournaments right now.</p>}
          {open.slice(0, 3).map(item => <Link className="player-home-event" key={item.id} to={'/player/tournaments/' + encodeURIComponent(item.id)}
            style={{ backgroundImage: `linear-gradient(90deg, #071b17ed, #071b1744), url(${tournamentImage})` }}>
            <small>Open registration</small><h3>{item.name}</h3><p>{formatDateDisplay(item.tournamentDate)} · {item.venueName}</p><span>View details ›</span>
          </Link>)}
        </div>
      </section>
    </div>

    <nav className="player-home-activity workspace-white-card" aria-label="Player activity">
      <Link to="/player/registrations"><AppIcon name="clipboard" /> Active entries ({active.length})</Link>
      <Link to="/player/tournaments?view=registrations"><AppIcon name="clipboard" /> My entries</Link>
      <Link to="/player/players"><AppIcon name="people" /> Find players</Link>
      <Link to="/player/court-bookings"><AppIcon name="calendar" /> My bookings</Link>
      <Link to="/player/connections"><AppIcon name="people" /> Connections</Link>
      <Link to="/player/medals"><AppIcon name="trophy" /> My medals</Link>
      <Link to="/player/results"><AppIcon name="bracket" /> Results</Link>
    </nav>
    <WorkspaceMenu />
  </div>
}

export default PlayerDashboard
