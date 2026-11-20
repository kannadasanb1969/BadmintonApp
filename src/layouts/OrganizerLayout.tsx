import { WorkspaceMenu } from '@/features/auth/components/WorkspaceMenu'
import { Link, Outlet } from 'react-router-dom'
import { logoutSession } from '@/api/apiClient'
import { useNotifications } from '@/features/notifications/hooks/useNotifications'
import { MobileAppHeader, MobileBottomNavigation, RolePageBack } from '@/components/mobile/MobileAppShell'

const OrganizerLayout = () => {
  const { unreadCount } = useNotifications()
  const navigation = [
    { to: '/organizer/dashboard', label: 'Home', icon: 'home' as const, match: (path: string) => path === '/organizer' || path.startsWith('/organizer/dashboard') },
    { to: '/organizer/tournaments', label: 'Tournaments', icon: 'trophy' as const, match: (path: string) => path.startsWith('/organizer/tournaments') && path !== '/organizer/tournaments/new' },
    { to: '/organizer/tournaments/new', label: 'Create', icon: 'plus' as const },
    { to: '/organizer/notifications', label: 'Inbox', icon: 'bell' as const },
  ]
  return <div className="mobile-app-shell organizer-shell">
    <MobileAppHeader textBrand brand="SmashPoint" section="Organizer" homeTo="/organizer/dashboard" notificationsTo="/organizer/notifications" unreadCount={unreadCount} onLogout={logoutSession} />
    <div className="desktop-role-bar"><div><Link to="/organizer/dashboard" className="desktop-role-brand"><strong className="app-role-wordmark">Smash<b>Point</b></strong><small>Organizer</small></Link><nav><Link to="/organizer/tournaments">Tournaments</Link><Link to="/organizer/notifications">Notifications</Link></nav></div><button type="button" onClick={logoutSession}>Logout</button></div>
    <main className="mobile-app-content"><RolePageBack homeTo="/organizer/dashboard" /><Outlet /><div className="mt-5"><WorkspaceMenu /></div></main>
    <MobileBottomNavigation items={navigation} />
  </div>
}

export default OrganizerLayout
