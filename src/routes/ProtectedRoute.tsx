import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

export const getProtectedRouteState = (hasHydrated: boolean, isAuthenticated: boolean) =>
  !hasHydrated ? 'loading' : isAuthenticated ? 'allow' : 'redirect'

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { hasHydrated, isAuthenticated } = useAuthStore()
  const location = useLocation()

  const routeState = getProtectedRouteState(hasHydrated, isAuthenticated)
  if (routeState === 'loading') {
    return <div className="text-center py-10">Loading...</div>
  }

  if (routeState === 'redirect') {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}

export default ProtectedRoute
