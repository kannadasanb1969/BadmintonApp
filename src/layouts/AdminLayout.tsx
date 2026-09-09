import { Link, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useNotifications } from '@/features/notifications/hooks/useNotifications'
import { MobileAppHeader, MobileBottomNavigation, RolePageBack } from '@/components/mobile/MobileAppShell'

const AdminLayout = () => {
  const logout = useAuthStore(state => state.logout)
  const { unreadCount } = useNotifications()
  const navigation = [
    { to: '/admin/dashboard', label: 'Home', icon: 'home' as const, match: (path: string) => path === '/admin' || path.startsWith('/admin/dashboard') },
    { to: '/admin/tournaments', label: 'Approvals', icon: 'clipboard' as const },
    { to: '/admin/tournaments', label: 'Tournaments', icon: 'trophy' as const, match: () => false },
    { to: '/admin/notifications', label: 'Inbox', icon: 'bell' as const },
    { to: '/admin/dashboard', label: 'Menu', icon: 'menu' as const, match: () => false },
  ]
  return <div className="mobile-app-shell admin-shell">
    <MobileAppHeader brand="SmashPoint" section="Admin" homeTo="/admin/dashboard" notificationsTo="/admin/notifications" unreadCount={unreadCount} onLogout={logout} />
    <div className="desktop-role-bar"><div><Link to="/admin/dashboard" className="desktop-role-brand"><span>🏸</span> SmashPoint <small>Admin</small></Link><nav><Link to="/admin/tournaments">Tournament queue</Link><Link to="/admin/notifications">Notifications</Link></nav></div><button type="button" onClick={logout}>Logout</button></div>
    <main className="mobile-app-content"><RolePageBack homeTo="/admin/dashboard" /><Outlet /></main>
    <MobileBottomNavigation items={navigation} />
  </div>
}

export default AdminLayout
