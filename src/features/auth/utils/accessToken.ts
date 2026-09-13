type AccessTokenPayload = { exp?: number }

const decodePayload = (accessToken: string): AccessTokenPayload | null => {
  try {
    const encoded = accessToken.split('.')[0]
    if (!encoded) return null
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(encoded.length / 4) * 4, '=')
    return JSON.parse(atob(base64)) as AccessTokenPayload
  } catch {
    return null
  }
}

/** Client-side expiry is only a session UX guard; the Worker still verifies authenticity. */
export const isAccessTokenExpired = (accessToken: unknown, nowSeconds = Math.floor(Date.now() / 1000)): boolean => {
  if (typeof accessToken !== 'string' || !accessToken.trim()) return true
  const payload = decodePayload(accessToken.trim())
  return typeof payload?.exp !== 'number' || payload.exp <= nowSeconds
}
