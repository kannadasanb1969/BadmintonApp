import assert from 'node:assert/strict'

import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'

const makeStorage = () => {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  }
}
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: makeStorage() })
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: makeStorage() })
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { localStorage: globalThis.localStorage, sessionStorage: globalThis.sessionStorage },
})

const { isAccessTokenExpired } = await import('../src/features/auth/utils/accessToken.ts')
const { useAuthStore } = await import('../src/store/authStore.ts')
const { default: apiClient, apiBaseUrl, getCurrentAccessToken, logoutSession } = await import('../src/api/apiClient.ts')
const { getProtectedRouteState } = await import('../src/routes/ProtectedRoute.tsx')
const { requestOtp, verifyOtpLogin } = await import('../src/features/auth/services/authService.ts')
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
const token = (exp: number) => `${encode({ sub: 'organizer', role: 'ORGANIZER', exp })}.test-signature`
const now = Math.floor(Date.now() / 1000)
const organizer = { id: 'organizer', mobile: '9999999999', role: 'ORGANIZER' as const }
const persistSession = (accessToken: string) => localStorage.setItem('badminton-auth', JSON.stringify({
  state: { user: organizer, isAuthenticated: true, accessToken },
  version: 1,
}))

assert.equal(useAuthStore.getState().hasHydrated, true)
assert.equal(useAuthStore.getState().isAuthenticated, false)
assert.equal(useAuthStore.getState().sessionMessage, null)
assert.equal(getProtectedRouteState(false, false), 'loading')
assert.equal(getProtectedRouteState(true, false), 'redirect')
assert.equal(getProtectedRouteState(true, true), 'allow')

assert.equal(isAccessTokenExpired(token(now + 60), now), false)
assert.equal(isAccessTokenExpired(token(now), now), true)
assert.equal(isAccessTokenExpired('legacy-token-without-expiry', now), true)

const freshToken = token(now + 60)
useAuthStore.setState({ user: null, isAuthenticated: false, accessToken: null, hasHydrated: false, sessionMessage: null })
assert.equal(useAuthStore.getState().sessionMessage, null)
sessionStorage.removeItem('badminton-auth')
persistSession(freshToken)
await useAuthStore.persist.rehydrate()
assert.equal(useAuthStore.getState().hasHydrated, true)
assert.equal(useAuthStore.getState().isAuthenticated, true)
assert.equal(useAuthStore.getState().user?.role, 'ORGANIZER')
assert.equal(localStorage.getItem('badminton-auth'), null)
assert.ok(sessionStorage.getItem('badminton-auth'))
assert.equal(useAuthStore.getState().sessionMessage, null)

let authorization = ''
await apiClient.get('/test', { adapter: async config => {
  authorization = String(config.headers.Authorization ?? '')
  return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
} })
assert.equal(authorization, `Bearer ${freshToken}`)

useAuthStore.getState().logout()
assert.equal(useAuthStore.getState().sessionMessage, null)

useAuthStore.getState().expireSession()
useAuthStore.getState().login(organizer, freshToken)
assert.equal(useAuthStore.getState().isAuthenticated, true)
assert.equal(useAuthStore.getState().sessionMessage, null)

useAuthStore.setState({ user: null, isAuthenticated: false, accessToken: null, hasHydrated: false, sessionMessage: null })
sessionStorage.removeItem('badminton-auth')
persistSession(token(now - 1))
await useAuthStore.persist.rehydrate()
assert.equal(useAuthStore.getState().hasHydrated, true)
assert.equal(useAuthStore.getState().isAuthenticated, false)
assert.match(useAuthStore.getState().sessionMessage ?? '', /expired/)
assert.equal(getCurrentAccessToken(), null)

const rejectedToken = token(now + 60)
useAuthStore.setState({ user: organizer, isAuthenticated: true, accessToken: rejectedToken, sessionMessage: null })
await assert.rejects(apiClient.get('/protected', { adapter: async config => Promise.reject({
  isAxiosError: true,
  message: 'Unauthorized',
  config,
  response: { status: 401, data: { message: 'Unauthorized' }, headers: {}, config },
}) }))
assert.equal(useAuthStore.getState().isAuthenticated, false)
assert.match(useAuthStore.getState().sessionMessage ?? '', /expired/)
const response = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({
  data, status: 200, statusText: 'OK', headers: {}, config,
})
const rejectStatus = (config: InternalAxiosRequestConfig, status: number) => Promise.reject({
  isAxiosError: true, message: 'Request failed', config,
  response: { status, data: { message: 'Request failed' }, headers: {}, config },
})
const rotatedToken = token(now + 120)
const authCalls: { url?: string; body: unknown; authorization: unknown }[] = []
apiClient.defaults.adapter = async config => {
  authCalls.push({ url: config.url, body: JSON.parse(config.data), authorization: config.headers.Authorization })
  if (config.url?.endsWith('request-otp')) return response(config, { success: true, message: 'OTP sent' })
  if (config.url?.endsWith('verify-otp')) {
    return response(config, { success: true, data: { user: organizer, accessToken: freshToken, refreshToken: 'initial-refresh' } })
  }
  throw new Error(`Unexpected request ${config.url}`)
}
useAuthStore.getState().login(organizer, freshToken)
assert.equal((await requestOtp(organizer.mobile)).message, 'OTP sent')
const login = await verifyOtpLogin(organizer.mobile, '12345', 'ORGANIZER')
assert.equal(login.refreshToken, 'initial-refresh')
assert.deepEqual(authCalls, [
  { url: '/api/auth/request-otp', body: { mobile: '+919999999999' }, authorization: undefined },
  { url: '/api/auth/verify-otp', body: { mobile: '+919999999999', otp: '12345', role: 'ORGANIZER' }, authorization: undefined },
])

const ownerLogin = await verifyOtpLogin(organizer.mobile, '12345')
assert.equal(ownerLogin.user.role, 'ORGANIZER')
assert.deepEqual(authCalls.at(-1)?.body, { mobile: '+919999999999', otp: '12345' })

useAuthStore.getState().login(login.user, login.accessToken, login.refreshToken)
let refreshes = 0
apiClient.defaults.adapter = async config => {
  if (config.url === '/api/auth/refresh') {
    refreshes += 1
    assert.deepEqual(JSON.parse(config.data), { refreshToken: 'initial-refresh' })
    assert.equal(config.headers.Authorization, undefined)
    return response(config, { success: true, data: { accessToken: rotatedToken, refreshToken: 'rotated-refresh' } })
  }
  if (config.headers.Authorization === `Bearer ${freshToken}`) return rejectStatus(config, 401)
  assert.equal(config.headers.Authorization, `Bearer ${rotatedToken}`)
  return response(config, {})
}
await Promise.all([apiClient.get('/protected/one'), apiClient.get('/protected/two')])
assert.equal(refreshes, 1)
assert.equal(useAuthStore.getState().refreshToken, 'rotated-refresh')
assert.equal(JSON.parse(sessionStorage.getItem('badminton-auth')!).state.refreshToken, 'rotated-refresh')
assert.equal(localStorage.getItem('badminton-auth'), null)

sessionStorage.setItem('badminton-auth', JSON.stringify({
  version: 1, state: { user: organizer, accessToken: token(now - 1), refreshToken: 'initial-refresh', isAuthenticated: true },
}))
await useAuthStore.persist.rehydrate()
assert.equal(useAuthStore.getState().isAuthenticated, true)
await apiClient.get('/protected/restored')
assert.equal(refreshes, 2)
assert.equal(getCurrentAccessToken(), rotatedToken)

useAuthStore.getState().login(organizer, token(now - 1), 'initial-refresh')
apiClient.defaults.adapter = async config => rejectStatus(config, 503)
await assert.rejects(apiClient.get('/protected'), { status: 503 })
assert.equal(useAuthStore.getState().isAuthenticated, true)
assert.equal(useAuthStore.getState().refreshToken, 'initial-refresh')

let markRefreshStarted!: () => void
const refreshStarted = new Promise<void>(resolve => { markRefreshStarted = resolve })
let finishRefresh!: () => void
const finish = new Promise<void>(resolve => { finishRefresh = resolve })
const revokedTokens: string[] = []
apiClient.defaults.adapter = async config => {
  if (config.url === '/api/auth/refresh') {
    markRefreshStarted()
    await finish
    return response(config, { accessToken: rotatedToken, refreshToken: 'late-refresh' })
  }
  assert.equal(config.url, '/api/auth/logout')
  assert.equal(config.headers.Authorization, undefined)
  revokedTokens.push(JSON.parse(config.data).refreshToken)
  return response(config, { success: true })
}
const pending = assert.rejects(apiClient.get('/protected'), { status: 401 })
await refreshStarted
logoutSession()
finishRefresh()
await pending
assert.deepEqual(revokedTokens, ['initial-refresh', 'late-refresh'])
assert.equal(useAuthStore.getState().isAuthenticated, false)
assert.equal(useAuthStore.getState().refreshToken, null)
console.log('PASS: Java OTP contract, legacy session migration, one refresh for concurrent requests, reload recovery, transient API failure and logout during refresh')

// A cold web backend is probed before any WhatsApp message is requested.
Object.defineProperty(window, 'location', { configurable: true, value: { origin: apiBaseUrl } })
const nativeTimeout = globalThis.setTimeout
const steps: string[] = []
let healthAttempts = 0
let otpAttempts = 0
try {
  globalThis.setTimeout = ((callback: () => void) => nativeTimeout(callback, 0)) as typeof setTimeout
  apiClient.defaults.adapter = async config => {
    steps.push(config.url ?? '')
    if (config.url === '/api/health') {
      healthAttempts++
      if (healthAttempts < 3) return rejectStatus(config, 503)
      return response(config, { success: true, message: 'Ready' })
    }
    otpAttempts++
    return response(config, { success: true, message: 'OTP sent' })
  }
  await requestOtp(organizer.mobile)
  assert.equal(healthAttempts, 3)
  assert.equal(otpAttempts, 1)
  assert.equal(steps.at(-1), '/api/auth/request-otp')

  steps.length = 0
  apiClient.defaults.adapter = config => { steps.push(config.url ?? ''); return rejectStatus(config, 503) }
  await assert.rejects(requestOtp(organizer.mobile), /still starting/)
  assert.equal(steps.length, 6)
  assert.ok(steps.every(path => path === '/api/health'))

  steps.length = 0
  apiClient.defaults.adapter = config => {
    steps.push(config.url ?? '')
    return config.url === '/api/health' ? Promise.resolve(response(config, { success: true })) : rejectStatus(config, 429)
  }
  await assert.rejects(requestOtp(organizer.mobile), { status: 429 })
  assert.deepEqual(steps, ['/api/health', '/api/auth/request-otp'])
} finally {
  globalThis.setTimeout = nativeTimeout
}
console.log('PASS: cold-start readiness retry, bounded failure, one OTP request and no replay after rate limiting')
