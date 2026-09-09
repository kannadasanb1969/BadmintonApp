import { Link, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useNotifications } from '@/features/notifications/hooks/useNotifications'
import { MobileAppHeader, MobileBottomNavigation, RolePageBack } from '@/components/mobile/MobileAppShell'

const OrganizerLayout = () => {
  const logout = useAuthStore(state => state.logout)
  const { unreadCount } = useNotifications()
  const navigation = [
    { to: '/organizer/dashboard', label: 'Home', icon: 'home' as const, match: (path: string) => path === '/organizer' || path.startsWith('/organizer/dashboard') },
    { to: '/organizer/tournaments', label: 'Tournaments', icon: 'trophy' as const },
    { to: '/organizer/tournaments/new', label: 'Create', icon: 'plus' as const },
    { to: '/organizer/notifications', label: 'Inbox', icon: 'bell' as const },
    { to: '/organizer/dashboard', label: 'Menu', icon: 'menu' as const, match: () => false },
  ]
  return <div className="mobile-app-shell organizer-shell">
    <MobileAppHeader brand="SmashPoint" section="Organizer" homeTo="/organizer/dashboard" notificationsTo="/organizer/notifications" unreadCount={unreadCount} onLogout={logout} />
    <div className="desktop-role-bar"><div><Link to="/organizer/dashboard" className="desktop-role-brand"><span>🏸</span> SmashPoint <small>Organizer</small></Link><nav><Link to="/organizer/tournaments">Tournaments</Link><Link to="/organizer/notifications">Notifications</Link></nav></div><button type="button" onClick={logout}>Logout</button></div>
    <main className="mobile-app-content"><RolePageBack homeTo="/organizer/dashboard" /><Outlet /></main>
    <MobileBottomNavigation items={navigation} />
  </div>
}

export default OrganizerLayout
