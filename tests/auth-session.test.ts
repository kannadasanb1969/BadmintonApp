import assert from 'node:assert/strict'

const values = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  },
})

const { isAccessTokenExpired } = await import('../src/features/auth/utils/accessToken.ts')
const { useAuthStore } = await import('../src/store/authStore.ts')
const { default: apiClient, getCurrentAccessToken } = await import('../src/api/apiClient.ts')
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
const token = (exp: number) => `${encode({ sub: 'organizer', role: 'ORGANIZER', exp })}.test-signature`
const now = Math.floor(Date.now() / 1000)

assert.equal(isAccessTokenExpired(token(now + 60), now), false)
assert.equal(isAccessTokenExpired(token(now), now), true)
assert.equal(isAccessTokenExpired('legacy-token-without-expiry', now), true)

const freshToken = token(now + 60)
useAuthStore.setState({ user: { id: 'organizer', mobile: '9999999999', role: 'ORGANIZER' }, isAuthenticated: true, accessToken: freshToken, sessionMessage: null })
let authorization = ''
await apiClient.get('/test', { adapter: async config => {
  authorization = String(config.headers.Authorization ?? '')
  return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
} })
assert.equal(authorization, `Bearer ${freshToken}`)

useAuthStore.setState({ user: { id: 'organizer', mobile: '9999999999', role: 'ORGANIZER' }, isAuthenticated: true, accessToken: token(now - 1), sessionMessage: null })
assert.equal(getCurrentAccessToken(), null)
assert.equal(useAuthStore.getState().isAuthenticated, false)
assert.match(useAuthStore.getState().sessionMessage ?? '', /expired/)

const rejectedToken = token(now + 60)
useAuthStore.setState({ user: { id: 'organizer', mobile: '9999999999', role: 'ORGANIZER' }, isAuthenticated: true, accessToken: rejectedToken, sessionMessage: null })
await assert.rejects(apiClient.get('/protected', { adapter: async config => Promise.reject({
  isAxiosError: true,
  message: 'Unauthorized',
  config,
  response: { status: 401, data: { message: 'Unauthorized' }, headers: {}, config },
}) }))
assert.equal(useAuthStore.getState().isAuthenticated, false)
assert.match(useAuthStore.getState().sessionMessage ?? '', /expired/)
console.log('PASS: fresh Bearer header, expired-token hard-refresh guard and current-token 401 session expiry')
