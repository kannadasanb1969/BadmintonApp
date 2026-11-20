import { Link, Outlet, useLocation } from 'react-router-dom'
import { logoutSession } from '@/api/apiClient'
import { useAuthStore } from '@/store/authStore'
import { useNotifications } from '@/features/notifications/hooks/useNotifications'
import { AppIcon, MobileAppHeader, MobileBottomNavigation, RolePageBack } from '@/components/mobile/MobileAppShell'

const PlayerLayout = () => {
  const { pathname } = useLocation()
  const light = /^\/player(?:\/?$|\/(?:dashboard|courts|court-bookings)(?:\/|$))/.test(pathname)
  const user = useAuthStore(state => state.user)
  const { unreadCount } = useNotifications()
  const navigation = [
    { to: '/player/dashboard', label: 'Home', icon: 'home' as const, match: (path: string) => path === '/player' || path.startsWith('/player/dashboard') },
    { to: '/player/friendly-matches', label: 'Games', icon: 'people' as const },
    { to: '/player/tournaments', label: 'Tournaments', icon: 'trophy' as const },
    { to: '/player/courts', label: 'Bookings', icon: 'calendar' as const, match: (path: string) => /^\/player\/(courts|court-bookings)(\/|$)/.test(path) },
    { to: '/player/profile', label: 'Profile', icon: 'user' as const },
  ]

  return <div className={`mobile-app-shell player-shell${light ? ' player-light' : ''}`}>
    <MobileAppHeader textBrand brand="SmashPoint" section="Player" homeTo="/player/dashboard" notificationsTo="/player/notifications" unreadCount={unreadCount} onLogout={logoutSession} />
    <div className="desktop-role-bar">
      <div><Link to="/player/dashboard" className="desktop-role-brand"><strong className="app-role-wordmark">Smash<b>Point</b></strong><small>Player</small></Link><nav>{navigation.map(item => <Link key={item.to} to={item.to}>{item.label}</Link>)}
          <Link to="/player/notifications" aria-label={`Notifications${unreadCount ? ', ' + unreadCount + ' unread' : ''}`}><AppIcon name="bell" /></Link>
        </nav></div>
      {user && <button type="button" onClick={logoutSession}>Logout</button>}
    </div>
    <main className="mobile-app-content"><RolePageBack homeTo="/player/dashboard" /><Outlet /></main>
    <MobileBottomNavigation items={navigation} />
  </div>
}

export default PlayerLayout
