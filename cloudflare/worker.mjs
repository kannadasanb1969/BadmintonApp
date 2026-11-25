const API_ORIGIN = 'https://smashpoint-whatsapp-reminders-prod.onrender.com'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.hostname === 'www.smashkaro.com') {
      url.hostname = 'smashkaro.com'
      return Response.redirect(url.toString(), 308)
    }
    if (url.pathname.startsWith('/api/')) {
      const upstream = new URL(API_ORIGIN)
      upstream.pathname = url.pathname
      upstream.search = url.search
      const headers = new Headers(request.headers)
      headers.delete('host')
      headers.delete('origin')
      headers.delete('cookie')
      headers.delete('referer')
      try {
        const forwarded = new Request(upstream, request)
        const response = await fetch(new Request(forwarded, { headers, redirect: 'manual' }))
        if (response.status === 101) return response
        const contentType = response.headers.get('Content-Type') || ''
        const starting = response.headers.get('x-render-routing') === 'hibernate-rate-limited'
          || (contentType.includes('text/html') && response.status === 200)
          || (!contentType.includes('application/json') && [502, 503].includes(response.status))
        if (starting) {
          await response.body?.cancel()
          return Response.json({
            success: false,
            code: 'SERVICE_STARTING',
            message: 'The server is starting. Please wait a minute and try again.',
          }, { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '10' } })
        }
        if (response.status === 429 && !contentType.includes('application/json')) {
          await response.body?.cancel()
          return Response.json({ success: false, message: 'Too many requests. Please wait a minute before trying again.' }, {
            status: 429,
            headers: { 'Cache-Control': 'no-store', 'Retry-After': response.headers.get('Retry-After') || '60' },
          })
        }
        const result = new Response(response.body, response)
        result.headers.set('Cache-Control', 'no-store')
        return result
      } catch {
        return Response.json({ success: false, message: 'The service is temporarily unavailable. Please try again.' }, {
          status: 502,
          headers: { 'Cache-Control': 'no-store' },
        })
      }
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405 })
    const response = await env.ASSETS.fetch(request)
    if (response.status === 404 && !url.pathname.startsWith('/assets/') && !url.pathname.split('/').pop().includes('.')) {
      url.pathname = '/index.html'
      return env.ASSETS.fetch(new Request(url, request))
    }
    return response
  },
}
