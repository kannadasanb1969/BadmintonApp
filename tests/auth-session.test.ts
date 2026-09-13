import assert from 'node:assert/strict'

const values = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  },
})
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { localStorage: globalThis.localStorage },
})

const { isAccessTokenExpired } = await import('../src/features/auth/utils/accessToken.ts')
const { useAuthStore } = await import('../src/store/authStore.ts')
const { default: apiClient, getCurrentAccessToken } = await import('../src/api/apiClient.ts')
const { getProtectedRouteState } = await import('../src/routes/ProtectedRoute.tsx')
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
const token = (exp: number) => `${encode({ sub: 'organizer', role: 'ORGANIZER', exp })}.test-signature`
const now = Math.floor(Date.now() / 1000)
const organizer = { id: 'organizer', mobile: '9999999999', role: 'ORGANIZER' as const }
const persistSession = (accessToken: string) => values.set('badminton-auth', JSON.stringify({
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
persistSession(freshToken)
await useAuthStore.persist.rehydrate()
assert.equal(useAuthStore.getState().hasHydrated, true)
assert.equal(useAuthStore.getState().isAuthenticated, true)
assert.equal(useAuthStore.getState().user?.role, 'ORGANIZER')
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
console.log('PASS: fresh Bearer header, expired-token hard-refresh guard and current-token 401 session expiry')
