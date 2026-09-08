import { Link, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useNotifications } from '@/features/notifications/hooks/useNotifications'
import { MobileAppHeader, MobileBottomNavigation, RolePageBack } from '@/components/mobile/MobileAppShell'

const PlayerLayout = () => {
  const { user, logout } = useAuthStore()
  const { unreadCount } = useNotifications()
  const navigation = [
    { to: '/player/dashboard', label: 'Home', icon: 'home' as const, match: (path: string) => path === '/player' || path.startsWith('/player/dashboard') },
    { to: '/player/tournaments', label: 'Tournaments', icon: 'trophy' as const },
    { to: '/player/registrations', label: 'Entries', icon: 'clipboard' as const },
    { to: '/player/fixtures', label: 'Fixtures', icon: 'bracket' as const },
    { to: '/player/profile', label: 'Profile', icon: 'user' as const },
  ]

  return <div className="mobile-app-shell">
    <MobileAppHeader brand="SmashPoint" section="Player" homeTo="/player/dashboard" notificationsTo="/player/notifications" unreadCount={unreadCount} />
    <div className="desktop-role-bar">
      <div><Link to="/player/dashboard" className="desktop-role-brand"><span>🏸</span> SmashPoint <small>Player</small></Link><nav>{navigation.map(item => <Link key={item.to} to={item.to}>{item.label}</Link>)}</nav></div>
      {user && <button type="button" onClick={logout}>Logout</button>}
    </div>
    <main className="mobile-app-content"><RolePageBack homeTo="/player/dashboard" /><Outlet /></main>
    <MobileBottomNavigation items={navigation} />
  </div>
}

export default PlayerLayout
