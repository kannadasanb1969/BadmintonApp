import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'

export type AppIconName = 'home' | 'trophy' | 'clipboard' | 'bracket' | 'bell' | 'user' | 'menu' | 'plus'

export const AppIcon = ({ name, className = 'h-5 w-5' }: { name: AppIconName; className?: string }) => {
  const paths: Record<AppIconName, ReactNode> = {
    home: <path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9Zm6 11v-6h6v6" />,
    trophy: <path d="M8 21h8m-4-4v4m-6-17h12v5a6 6 0 0 1-12 0V4Zm0 2H3v1a4 4 0 0 0 4 4m10-5h4v1a4 4 0 0 1-4 4" />,
    clipboard: <path d="M9 5h6m-5-2h4a2 2 0 0 1 2 2v1H8V5a2 2 0 0 1 2-2Zm-4 3h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2Zm3 5h8m-8 4h5" />,
    bracket: <path d="M4 4h4v4H6v2h4v4H6v2h2v4H4m16-16h-4v4h2v2h-4v4h4v2h-2v4h4" />,
    bell: <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 22h4" />,
    user: <path d="M20 21a8 8 0 0 0-16 0m12-13a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    plus: <path d="M12 5v14M5 12h14" />,
  }
  return <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">{paths[name]}</svg>
}

export type MobileNavItem = { to: string; label: string; icon: AppIconName; match?: (pathname: string) => boolean }

export const MobileAppHeader = ({ brand, section, homeTo, notificationsTo, unreadCount, onLogout }: { brand: string; section: string; homeTo: string; notificationsTo: string; unreadCount: number; onLogout: () => void }) => {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const rootPath = homeTo.replace(/\/dashboard$/, '')
  const showBack = pathname !== homeTo && pathname !== rootPath
  const goBack = () => window.history.length > 1 ? navigate(-1) : navigate(homeTo)
  return <header className="mobile-app-header">
    <div className="mobile-app-header-inner">
      {showBack && <button type="button" className="mobile-back-button" onClick={goBack} aria-label="Go back"><span aria-hidden="true">‹</span></button>}
      <Link to={homeTo} className="mobile-brand" aria-label={`${brand} home`}>
        <span className="mobile-brand-mark"><AppIcon name="trophy" className="h-5 w-5" /></span>
        <span><strong>{brand}</strong><small>{section}</small></span>
      </Link>
      <div className="mobile-header-actions">
        <button type="button" className="mobile-logout-button" onClick={onLogout}>Logout</button>
        <Link to={notificationsTo} className="mobile-notification-button" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}>
          <AppIcon name="bell" />
          {unreadCount > 0 && <span>{unreadCount > 9 ? '9+' : unreadCount}</span>}
        </Link>
      </div>
    </div>
  </header>
}

export const RolePageBack = ({ homeTo }: { homeTo: string }) => {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const rootPath = homeTo.replace(/\/dashboard$/, '')
  if (pathname === homeTo || pathname === rootPath) return null
  return <button type="button" className="desktop-page-back" onClick={() => window.history.length > 1 ? navigate(-1) : navigate(homeTo)}>← Back</button>
}

export const MobileBottomNavigation = ({ items }: { items: MobileNavItem[] }) => {
  const { pathname } = useLocation()
  return (
    <nav className="mobile-bottom-navigation" aria-label="Primary navigation">
      {items.map((item) => {
        const active = item.match ? item.match(pathname) : pathname === item.to || pathname.startsWith(`${item.to}/`)
        return <Link key={item.to} to={item.to} className={active ? 'is-active' : ''} aria-current={active ? 'page' : undefined}><AppIcon name={item.icon} /><span>{item.label}</span></Link>
      })}
    </nav>
  )
}
