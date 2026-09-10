import axios, { AxiosError } from 'axios'
import { useAuthStore } from '@/store/authStore'

export interface ApiEnvelope<T> {
  success: boolean
  data?: T
  message?: string
}

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message)
    this.name = 'ApiError'
  }
}

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787'
export const isExplicitMockApiMode = import.meta.env.VITE_API_MODE === 'mock'

/**
 * Resolves the token at request time, rather than when this module is loaded.
 * That keeps the shared HTTP client in sync across login, logout, re-login,
 * and persisted-session hydration.
 */
export const getCurrentAccessToken = (): string | null => {
  const accessToken = useAuthStore.getState().accessToken
  const normalizedToken = typeof accessToken === 'string' ? accessToken.trim() : ''
  return normalizedToken || null
}

export const unwrapApiData = <T>(payload: ApiEnvelope<T> | T): T => {
  if (payload && typeof payload === 'object' && 'success' in payload) {
    const envelope = payload as ApiEnvelope<T>
    if (!envelope.success) throw new ApiError(envelope.message || 'API request failed')
    // OTP request responses intentionally carry only a success message (and, in
    // development, a server-provided helper). Preserve that payload instead of
    // turning it into undefined while still unwrapping normal { success, data }.
    return ('data' in envelope ? envelope.data : envelope) as T
  }
  return payload as T
}

export const normalizeApiError = (error: unknown): ApiError => {
  if (error instanceof ApiError) return error
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ message?: string }>
    return new ApiError(
      axiosError.response?.data?.message || axiosError.message || 'Unable to reach the API',
      axiosError.response?.status,
    )
  }
  return new ApiError(error instanceof Error ? error.message : 'Unexpected API error')
}

const apiClient = axios.create({
  baseURL: apiBaseUrl,
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use((config) => {
  const accessToken = getCurrentAccessToken()
  if (accessToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => {
    response.data = unwrapApiData(response.data)
    return response
  },
  (error) => Promise.reject(normalizeApiError(error)),
)

export default apiClient
