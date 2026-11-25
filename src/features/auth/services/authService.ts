import { User, Role } from '@/types/auth.types'
import { PlayerProfile } from '@/features/player/types/player.types'
import apiClient, { apiBaseUrl, ApiError, isExplicitMockApiMode } from '@/api/apiClient'

type ApiUser = User & { name?: string | null; isActive?: boolean }
export type AuthLoginResponse = { user: User; playerProfile: PlayerProfile | null; accessToken: string; refreshToken: string | null }
type ApiAuthResponse = { user: ApiUser; playerProfile?: PlayerProfile | null; accessToken?: string; refreshToken?: string }
export type OtpRequestResponse = { success: true; message: string; developmentOtp?: string }

const toAuthUser = (user: ApiUser | ApiAuthResponse): User => {
  const account = 'user' in user ? user.user : user
  return {
    id: account.id,
    mobile: account.mobile,
    role: account.role,
    ...(account.displayName ? { displayName: account.displayName } : account.name ? { displayName: account.name } : {}),
  }
}

const authPath = (path: string) => isExplicitMockApiMode ? path : `/api${path}`

export const requestOtp = async (mobile: string, onStatus?: (message: string) => void): Promise<OtpRequestResponse> => {
  if (!/^[6-9]\d{9}$/.test(mobile)) throw new Error('Invalid mobile number')
  const sameOriginApi = typeof window !== 'undefined' && apiBaseUrl === window.location?.origin
  if (!isExplicitMockApiMode && sameOriginApi) {
    onStatus?.('Connecting to server…')
    // Only health checks are retried. The OTP request is sent once after readiness.
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        await apiClient.get('/api/health', { timeout: 8000 })
        break
      } catch (error) {
        const transient = error instanceof ApiError && (error.status === undefined || [502, 503, 504].includes(error.status))
        if (!transient) throw error
        if (attempt === 5) throw new Error('The server is still starting. Please wait a minute and try again.')
        await new Promise(resolve => setTimeout(resolve, 3000))
      }
    }
  }
  onStatus?.('Sending OTP…')
  return (await apiClient.post<OtpRequestResponse>(authPath('/auth/request-otp'), { mobile: isExplicitMockApiMode ? mobile : `+91${mobile}` })).data
}

export const verifyOtpLogin = async (mobile: string, otp: string, role?: Role): Promise<AuthLoginResponse> => {
  if (!/^[6-9]\d{9}$/.test(mobile)) throw new Error('Invalid mobile number')
  if (!/^\d{5}$/.test(otp)) throw new Error('Enter the five-digit OTP')
  const path = isExplicitMockApiMode ? '/auth/login' : '/auth/verify-otp'
  const response = (await apiClient.post<ApiAuthResponse>(authPath(path), {
    mobile: isExplicitMockApiMode ? mobile : `+91${mobile}`, otp, ...(role ? { role } : {}),
  })).data
  if (!response.accessToken) throw new Error('Login response did not include an access token')
  return { user: toAuthUser(response), playerProfile: response.playerProfile ?? null, accessToken: response.accessToken, refreshToken: response.refreshToken ?? null }
}

/**
 * Mock login function
 * Simulates API delay and returns a mock user based on role
 */
export const mockLogin = async (mobile: string, role: Role): Promise<User> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500))

  // Basic validation (should be done in UI too, but double-check)
  if (!/^[6-9]\d{9}$/.test(mobile)) {
    throw new Error('Invalid mobile number')
  }

  // Generate a mock ID - deterministic based on role and mobile
  const id = `${role.toLowerCase()}-${mobile}`

  const user: User = {
    id,
    mobile,
    role,
    displayName: `${role} User`
  }

  try {
    if (!isExplicitMockApiMode) throw new Error('Request and verify an OTP before logging in')
    return toAuthUser((await apiClient.post<ApiAuthResponse>(authPath('/auth/login'), { mobile, role })).data)
  } catch (error) {
    if (isExplicitMockApiMode && import.meta.env.VITE_ENABLE_MOCK_AUTH_FALLBACK === 'true') {
      return user
    }
    throw error
  }
}

/** Reads the persisted account again so the API remains the source of truth. */
export const getCurrentUser = async (userId: string): Promise<User> => {
  const user = (await apiClient.get<ApiUser>(`/api/users/${userId}`)).data
  if (user.isActive === false) throw new Error('This account is inactive')
  return toAuthUser(user)
}
