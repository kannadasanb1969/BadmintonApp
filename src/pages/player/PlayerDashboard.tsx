import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { queryClient } from '@/api/queryClient'
import { WorkspaceMenu } from '@/features/auth/components/WorkspaceMenu'
import { locationParams, useDiscoveryLocation } from '@/features/location/CityPicker'
import { useNotifications } from '@/features/notifications/hooks/useNotifications'
import { usePlayerProfileStore } from '@/features/player/store/playerProfileStore'
import { useRegistrationStore } from '@/features/registrations/store/registrationStore'
import { useTournamentStore } from '@/features/tournaments/store/tournamentStore'
import { tournamentService } from '@/features/tournaments/services/tournamentService'
import { formatDateDisplay } from '@/features/tournaments/utils/tournamentHelpers'
import { useAuthStore } from '@/store/authStore'
import { AppIcon } from '@/components/mobile/MobileAppShell'
import dashboardBackground from '@/assets/ref2.png'

const panel = 'grid gap-3 rounded-2xl border border-emerald-100 bg-white p-4 sm:p-5'
const action = 'inline-flex min-h-10 items-center rounded-lg bg-emerald-800 px-3 py-2 font-semibold text-white'
const outline = 'inline-flex min-h-10 items-center rounded-lg border border-emerald-800 bg-white px-3 py-2 font-semibold text-emerald-900'

const PlayerDashboard = () => {
  const user = useAuthStore(state => state.user)
  const profile = usePlayerProfileStore(state => state.profile)
  const { unreadCount } = useNotifications()
  const tournaments = useTournamentStore(state => state.tournaments)
  const registrations = useRegistrationStore(state => state.registrations)
  const location = useDiscoveryLocation(state => state.location)
  const nearby = useQuery({
    queryKey: ['home-nearby-tournaments', user?.id, location],
    queryFn: ({ signal }) => tournamentService.discover({ ...(location ? locationParams(location) : {}), nearby: true, view: 'OPEN', size: 6, page: 1 }, signal),
    enabled: Boolean(user && location), retry: false,
  }, queryClient)

  if (!user) return <div className="p-6 text-center">Please log in</div>

  const confirmed = registrations.filter(item => item.playerId === profile?.id && ['REGISTERED', 'CONFIRMED'].includes(item.status))
  const open = (location ? nearby.data?.items ?? [] : tournaments).filter(item =>
    item.status === 'PUBLISHED' && item.categories.some(category => category.registrationPhase === 'OPEN' && !confirmed.some(entry => entry.categoryId === category.id && entry.tournamentId === item.id)),
  )
  const playerName = profile?.fullName?.trim().split(/\s+/)[0] || user.displayName?.trim().split(/\s+/)[0] || 'Player'
  const stats = [
    { label: 'Active entries', value: confirmed.length, to: '/player/registrations', icon: 'clipboard' as const },
    { label: 'Open tournaments', value: open.length, to: '/player/tournaments', icon: 'trophy' as const },
    { label: 'New alerts', value: unreadCount, to: '/player/notifications', icon: 'bell' as const },
  ]

  return <main className="mx-auto grid max-w-6xl gap-4 rounded-2xl bg-[#edf6ef] p-4 text-emerald-950 sm:p-6">
    <header className="relative isolate overflow-hidden rounded-2xl bg-emerald-950 p-5 text-white sm:p-8" style={{ backgroundImage: `linear-gradient(90deg, rgb(4 40 29 / .98), rgb(4 40 29 / .7)), url(${dashboardBackground})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <p className="text-sm font-semibold text-emerald-100">Smash Karo</p>
      <h1 className="my-2 text-3xl font-extrabold sm:text-4xl">Hi, {playerName}</h1>
      {profile ? <Link to="/player/profile" className="font-semibold text-emerald-100 underline">{profile.playerCode} · View profile</Link>
        : <Link to="/player/profile" className="font-semibold text-emerald-100 underline">Complete your player profile</Link>}
    </header>

    <section className="grid gap-3 sm:grid-cols-3" aria-label="Player overview">
      {stats.map(item => <Link className={panel} to={item.to} key={item.label}>
        <AppIcon name={item.icon} /><strong className="text-2xl">{item.value}</strong><span>{item.label}</span>
      </Link>)}
    </section>

    <section className={panel}>
      <h2 className="text-xl font-bold">Book a court</h2>
      <div className="flex flex-wrap gap-2"><Link className={action} to="/player/courts">Find courts</Link><Link className={outline} to="/player/court-bookings">My bookings</Link></div>
    </section>

    <nav className="flex flex-wrap gap-2" aria-label="Player tools">
      {([['friendly-matches', 'Friendly Matches'], ['connections', 'Connections'], ['medals', 'My medals'], ['results', 'Results']] as const).map(([path, label]) =>
        <Link key={path} className={outline} to={'/player/' + path}>{label}</Link>,
      )}
    </nav>

    <div className="grid gap-4 lg:grid-cols-2">
      <section className={panel}>
        <header className="flex flex-wrap justify-between gap-2"><h2 className="text-xl font-bold">{location ? 'Nearby tournaments' : 'Open tournaments'}</h2><Link className="font-semibold underline" to="/player/tournaments">Browse tournaments</Link></header>
        {location && nearby.error && <p role="alert">Could not load nearby tournaments. <button className="underline" onClick={() => void nearby.refetch()}>Retry</button></p>}
        {location && nearby.isLoading && <p role="status">Loading nearby tournaments…</p>}
        {open.length === 0 && (!location || nearby.isSuccess) && <p>No open tournaments right now.</p>}
        {open.slice(0, 3).map(item => <Link key={item.id} to={'/player/tournaments/' + encodeURIComponent(item.id)} className="grid gap-1 rounded-xl bg-emerald-50 p-3">
          <strong>{item.name}</strong><span className="text-sm">{formatDateDisplay(item.tournamentDate)} · {item.venueName}</span>
        </Link>)}
      </section>
      <section className={panel}>
        <header className="flex flex-wrap justify-between gap-2"><h2 className="text-xl font-bold">My registrations</h2><Link className="font-semibold underline" to="/player/registrations">All registrations</Link></header>
        {confirmed.length === 0 && <p>Your confirmed entries will show here.</p>}
        {confirmed.slice(0, 3).map(item => <Link key={item.id} to={'/player/registrations/' + encodeURIComponent(item.id)} className="grid gap-1 rounded-xl bg-emerald-50 p-3">
          <strong>{item.categoryName}</strong><span className="text-sm">{item.registrationCode} · {formatDateDisplay(item.registeredAt)}</span>
        </Link>)}
      </section>
    </div>
    <WorkspaceMenu />
  </main>
}
export default PlayerDashboard
