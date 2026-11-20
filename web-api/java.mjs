export class WebApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export function resourceId(id) {
  if (typeof id !== 'string' || !/^[\w:-]{1,128}$/.test(id)) {
    throw new WebApiError(400, 'Invalid resource ID')
  }
  return encodeURIComponent(id)
}

export function javaClient(origin) {
  return async (authorization, path, method = 'GET', body) => {
    let response, payload
    try {
      response = await fetch(new URL(path, origin), {
        method,
        headers: { authorization, 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: 'error',
        signal: AbortSignal.timeout(6000),
      })
      payload = await response.json()
    } catch {
      throw new WebApiError(502, 'The Java API is unavailable')
    }
    if (!response.ok || payload?.success !== true) {
      throw new WebApiError(response.status >= 400 && response.status < 500 ? response.status : 502,
        response.status >= 400 && response.status < 500 ? payload?.message ?? 'Request declined' : 'The upstream service could not complete this request')
    }
    return payload.data
  }
}

export function authenticate(java) {
  return async (req, _res, next) => {
    const authorization = req.get('authorization') || ''
    let id
    try {
      const match = /^Bearer ([\w-]+)\.([\w-]+)\.([\w-]+)$/.exec(authorization)
      const claims = JSON.parse(Buffer.from(match?.[2] ?? '', 'base64url').toString())
      id = resourceId(claims.sub)
    } catch {
      throw new WebApiError(401, 'Sign in to continue')
    }
    // The unverified subject only selects the who-am-I URL. Java validates the bearer and account.
    const user = await java(authorization, '/api/users/' + id)
    if (typeof user?.id !== 'string' || id !== encodeURIComponent(user.id) || user.isActive === false) {
      throw new WebApiError(401, 'Sign in to continue')
    }
    req.webUser = user
    req.java = (path, method, body) => java(authorization, path, method, body)
    next()
  }
}
