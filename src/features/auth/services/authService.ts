import { User, Role } from '@/types/auth.types'
import apiClient from '@/api/apiClient'

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
    return (await apiClient.post<User>('/auth/login', { mobile, role })).data
  } catch {
    return user
  }
}
