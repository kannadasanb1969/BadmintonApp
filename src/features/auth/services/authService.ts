import { User, Role } from '@/types/auth.types'
import { PlayerProfile } from '@/features/player/types/player.types'
import apiClient, { isExplicitMockApiMode } from '@/api/apiClient'

type WorkerUser = User & { name?: string | null; isActive?: boolean }
export type AuthLoginResponse = { user: User; playerProfile: PlayerProfile | null }
type WorkerAuthResponse = { user: WorkerUser; playerProfile?: PlayerProfile | null }
export type OtpRequestResponse = { success: true; message: string; developmentOtp?: string }

const toAuthUser = (user: WorkerUser | WorkerAuthResponse): User => {
  const account = 'user' in user ? user.user : user
  return {
    id: account.id,
    mobile: account.mobile,
    role: account.role,
    ...(account.displayName ? { displayName: account.displayName } : account.name ? { displayName: account.name } : {}),
  }
}

const authPath = (path: string) => isExplicitMockApiMode ? path : `/api${path}`

export const requestOtp = async (mobile: string): Promise<OtpRequestResponse> => {
  if (!/^[6-9]\d{9}$/.test(mobile)) throw new Error('Invalid mobile number')
  return (await apiClient.post<OtpRequestResponse>(authPath('/auth/request-otp'), { mobile })).data
}

export const verifyOtpLogin = async (mobile: string, otp: string, role: Role): Promise<AuthLoginResponse> => {
  if (!/^[6-9]\d{9}$/.test(mobile)) throw new Error('Invalid mobile number')
  if (!/^\d{5}$/.test(otp)) throw new Error('Enter the five-digit OTP')
  const response = (await apiClient.post<WorkerAuthResponse>(authPath('/auth/login'), { mobile, otp, role })).data
  return { user: toAuthUser(response), playerProfile: response.playerProfile ?? null }
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
    return toAuthUser((await apiClient.post<WorkerAuthResponse>(authPath('/auth/login'), { mobile, role })).data)
  } catch (error) {
    if (isExplicitMockApiMode && import.meta.env.VITE_ENABLE_MOCK_AUTH_FALLBACK === 'true') {
      return user
    }
    throw error
  }
}

/** Reads the persisted account again so the Worker remains the source of truth. */
export const getCurrentUser = async (userId: string): Promise<User> => {
  const user = (await apiClient.get<WorkerUser>(`/api/users/${userId}`)).data
  if (user.isActive === false) throw new Error('This account is inactive')
  return toAuthUser(user)
}
