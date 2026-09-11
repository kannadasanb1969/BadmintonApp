import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { usePlayerProfileStore } from '@/features/player/store/playerProfileStore'
import { useNotifications } from '@/features/notifications/hooks/useNotifications'
import { useTournamentStore } from '@/features/tournaments/store/tournamentStore'
import { useRegistrationStore } from '@/features/registrations/store/registrationStore'
import { formatDateDisplay } from '@/features/tournaments/utils/tournamentHelpers'
import { AppIcon } from '@/components/mobile/MobileAppShell'

const PlayerDashboard = () => {
  const user = useAuthStore(state => state.user)
  const { profile, hasProfile } = usePlayerProfileStore()
  const navigate = useNavigate()
  const { unreadCount } = useNotifications()
  const tournaments = useTournamentStore(state => state.tournaments)
  const registrations = useRegistrationStore(state => state.registrations)
  const availableTournaments = useMemo(() => tournaments.filter(t => t.status === 'PUBLISHED').filter(t => t.categories.some(c => c.registrationPhase === 'OPEN' && !registrations.some(r => r.tournamentId === t.id && r.categoryId === c.id && r.status === 'REGISTERED'))), [tournaments, registrations])
  const userRegistrations = useMemo(() => registrations.filter(r => r.playerId === profile?.id && r.status === 'REGISTERED'), [registrations, profile])
  const initials = profile?.fullName.split(' ').map(name => name[0]).join('').slice(0, 2).toUpperCase() ?? 'SP'

  if (!user) return <div className="p-6 text-center">Please log in</div>

  return <div className="player-dashboard space-y-6 px-4 py-5 sm:px-2 sm:py-0">
    <section className="player-dashboard-hero"><div className="relative z-10 flex items-start justify-between gap-4"><div><p>Welcome back</p><h1>Hi, {profile?.fullName?.split(' ')[0] || 'Player'} 👋</h1><span>{profile ? `${profile.playerCode} · Ready for your next rally` : 'Set up your profile to start playing'}</span></div>{profile?.profilePhoto ? <img className="h-14 w-14 rounded-2xl object-cover ring-2 ring-white/40" src={profile.profilePhoto} alt="Profile" /> : <div className="player-avatar">{initials}</div>}</div>{!hasProfile && <button type="button" onClick={() => navigate('/player/profile')} className="player-profile-prompt">Complete your player profile <span>→</span></button>}</section>

    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4"><button type="button" onClick={() => navigate('/player/registrations')} className="player-stat-card"><AppIcon name="clipboard" /><strong>{userRegistrations.length}</strong><span>Active entries</span></button><button type="button" onClick={() => navigate('/player/tournaments')} className="player-stat-card"><AppIcon name="trophy" /><strong>{availableTournaments.length}</strong><span>Open events</span></button><button type="button" onClick={() => navigate('/player/players')} className="player-stat-card"><AppIcon name="user" /><strong>Find</strong><span>Players</span></button><button type="button" onClick={() => navigate('/player/notifications')} className="player-stat-card"><AppIcon name="bell" /><strong>{unreadCount}</strong><span>New alerts</span></button></section>

    <section><div className="player-dashboard-heading"><div><p>Step onto the court</p><h2>Open tournaments</h2></div><button type="button" onClick={() => navigate('/player/tournaments')}>View all</button></div><div className="space-y-3">{availableTournaments.slice(0, 2).map(tournament => <button key={tournament.id} type="button" onClick={() => navigate(`/player/tournaments/${tournament.id}`)} className="player-tournament-preview"><div className="player-date-block"><b>{new Date(`${tournament.tournamentDate}T00:00:00`).getDate()}</b><span>{new Date(`${tournament.tournamentDate}T00:00:00`).toLocaleDateString('en-IN', { month: 'short' })}</span></div><div className="min-w-0 flex-1 text-left"><span className="player-open-badge">Open registration</span><h3>{tournament.name}</h3><p>{tournament.venueName} · {tournament.categories.length} categories</p></div><span className="player-preview-arrow">›</span></button>)}{availableTournaments.length === 0 && <div className="player-dashboard-empty"><AppIcon name="trophy" /><p>No open tournaments right now.</p><button type="button" onClick={() => navigate('/player/tournaments')}>Browse events</button></div>}</div></section>

    <section><div className="player-dashboard-heading"><div><p>Your tournament journey</p><h2>My registrations</h2></div><button type="button" onClick={() => navigate('/player/registrations')}>View all</button></div>{userRegistrations.length ? <div className="player-registration-preview">{userRegistrations.slice(0, 2).map(registration => <div key={registration.id}><span>CONFIRMED</span><h3>{registration.categoryName}</h3><p>{registration.tournamentCode} · Registered {formatDateDisplay(registration.registeredAt)}</p></div>)}</div> : <div className="player-dashboard-empty compact"><AppIcon name="clipboard" /><p>Your confirmed entries will show here.</p></div>}</section>
  </div>
}

export default PlayerDashboard
