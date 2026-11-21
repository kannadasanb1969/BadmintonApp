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
