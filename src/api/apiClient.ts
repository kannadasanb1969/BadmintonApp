import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { getApiBaseUrl } from '@/config/env'
import { useAuthStore } from '@/store/authStore'
import { isAccessTokenExpired } from '@/features/auth/utils/accessToken'

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

export const apiBaseUrl = getApiBaseUrl()
export const webApiBaseUrl = import.meta.env.VITE_WEB_API_BASE_URL?.replace(/\/+$/, '') as string | undefined
export const webApiPath = '/api/web/v1'
export const isExplicitMockApiMode = import.meta.env.VITE_API_MODE === 'mock'

export const getCurrentAccessToken = (): string | null => {
  const { accessToken, refreshToken, expireSession } = useAuthStore.getState()
  if (!accessToken) return null
  if (!isAccessTokenExpired(accessToken)) return accessToken
  if (!refreshToken) expireSession()
  return null
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
  timeout: 15000,
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
})

const publicAuthPaths = new Set([
  '/auth/request-otp', '/auth/verify-otp', '/auth/login', '/auth/refresh', '/auth/logout',
])

type SessionRequest = InternalAxiosRequestConfig & {
  sessionRevision?: number
  authRetried?: boolean
}

const revokeSession = async (refreshToken: string) => {
  // Local logout still succeeds if the session is already revoked or the API is offline.
  await apiClient.post('/api/auth/logout', { refreshToken }).catch(() => undefined)
}

let pendingRefresh: { revision: number; result: Promise<string | null> } | undefined

const refreshSession = (revision: number): Promise<string | null> => {
  if (pendingRefresh?.revision === revision) return pendingRefresh.result
  const { refreshToken, sessionRevision } = useAuthStore.getState()
  if (!refreshToken || sessionRevision !== revision) return Promise.resolve(null)

  const result = apiClient.post<{ accessToken: string; refreshToken: string }>('/api/auth/refresh', { refreshToken })
    .then(({ data }) => {
      if (!data.refreshToken || isAccessTokenExpired(data.accessToken)) {
        throw new ApiError('Invalid session response from the API')
      }
      if (useAuthStore.getState().sessionRevision !== revision) {
        void revokeSession(data.refreshToken)
        return null
      }
      useAuthStore.setState({ accessToken: data.accessToken, refreshToken: data.refreshToken })
      return data.accessToken
    })
    .catch((error: unknown) => {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        if (useAuthStore.getState().sessionRevision === revision) useAuthStore.getState().expireSession()
        return null
      }
      throw error
    })
    .finally(() => {
      if (pendingRefresh?.result === result) pendingRefresh = undefined
    })
  pendingRefresh = { revision, result }
  return result
}

export const logoutSession = () => {
  const { refreshToken, logout } = useAuthStore.getState()
  logout()
  if (refreshToken) void revokeSession(refreshToken)
}

apiClient.interceptors.request.use(async (config: SessionRequest) => {
  const path = config.url?.split('?')[0].replace(/^\/api(?=\/)/, '') ?? ''
  if (publicAuthPaths.has(path)) return config
  const webRequest = Boolean(webApiBaseUrl) && config.baseURL === webApiBaseUrl &&
    config.url?.startsWith(webApiPath + '/')
  if (!path.startsWith('/') || path.startsWith('//') || (config.baseURL !== apiBaseUrl && !webRequest)) return config

  const { sessionRevision, refreshToken } = useAuthStore.getState()
  if (config.sessionRevision !== undefined && config.sessionRevision !== sessionRevision) {
    throw new ApiError('The session changed before the request could finish', 401)
  }
  const accessToken = getCurrentAccessToken() ?? (refreshToken ? await refreshSession(sessionRevision) : null)
  if (refreshToken && useAuthStore.getState().sessionRevision !== sessionRevision) {
    throw new ApiError('The session changed before the request could finish', 401)
  }
  if (accessToken) {
    config.sessionRevision = sessionRevision
    config.headers.Authorization = `Bearer ${accessToken}`
  } else if (config.authRetried || config.signal?.aborted) {
    throw new ApiError('The request could not be retried', 401)
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => {
    const { sessionRevision } = response.config as SessionRequest
    if (sessionRevision !== undefined && sessionRevision !== useAuthStore.getState().sessionRevision) {
      throw new ApiError('The session changed before the request could finish', 401)
    }
    response.data = unwrapApiData(response.data)
    return response
  },
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || error.response?.status !== 401) throw normalizeApiError(error)
    const request = error.config as SessionRequest | undefined
    const { accessToken, refreshToken, sessionRevision, expireSession } = useAuthStore.getState()
    if (!request || request.sessionRevision !== sessionRevision || request.signal?.aborted || !accessToken) {
      throw normalizeApiError(error)
    }

    const sentWithCurrentToken = request.headers.Authorization === `Bearer ${accessToken}`
    if (!request.authRetried && (refreshToken || !sentWithCurrentToken)) {
      const nextToken = sentWithCurrentToken ? await refreshSession(sessionRevision) : getCurrentAccessToken()
      if (nextToken) {
        request.authRetried = true
        return apiClient.request(request)
      }
    } else if (sentWithCurrentToken) {
      expireSession()
    }
    throw normalizeApiError(error)
  },
)

export default apiClient
