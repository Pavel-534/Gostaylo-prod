/**
 * Cloudflare Worker — reverse proxy: gostaylo.ru → Vercel (трафик к Vercel не идёт напрямую из РФ).
 *
 * Переменные (Workers → Settings → Variables):
 *   UPSTREAM_ORIGIN  — https://gostaylo-prod.vercel.app  (без слэша в конце)
 *   UPSTREAM_HOST    — gostaylo-prod.vercel.app (Host для upstream; как в ТЗ для Vercel)
 *
 * Опционально:
 *   PUBLIC_HOST      — если в проекте Vercel добавлен кастомный домен (например gostaylo.ru),
 *                      задайте его — Host пойдёт на Vercel как этот домен (куки/редиректы корректнее).
 *                      Иначе оставьте пустым — используется UPSTREAM_HOST.
 */

export default {
  async fetch(request, env) {
    const upstreamOrigin = (env.UPSTREAM_ORIGIN || '').replace(/\/$/, '')
    let upstreamHost = (env.UPSTREAM_HOST || '').trim()
    const publicHost = (env.PUBLIC_HOST || '').trim()

    if (!upstreamOrigin) {
      return new Response('Worker: set UPSTREAM_ORIGIN', {
        status: 500,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      })
    }

    if (!upstreamHost) {
      try {
        upstreamHost = new URL(upstreamOrigin).host
      } catch {
        return new Response('Worker: invalid UPSTREAM_ORIGIN', {
          status: 500,
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        })
      }
    }

    const hostToSend = publicHost || upstreamHost

    const url = new URL(request.url)
    const target = new URL(url.pathname + url.search + url.hash, upstreamOrigin)

    const headers = new Headers(request.headers)
    headers.set('Host', hostToSend)
    headers.set('X-Forwarded-Host', url.host)
    headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''))

    const cfIp = request.headers.get('CF-Connecting-IP')
    if (cfIp) {
      const prev = request.headers.get('X-Forwarded-For')
      headers.set('X-Forwarded-For', prev ? `${prev}, ${cfIp}` : cfIp)
    }

    const proxyReq = new Request(target.toString(), {
      method: request.method,
      headers,
      body: request.body,
      redirect: 'manual',
    })

    const res = await fetch(proxyReq)

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('Location')
      if (loc) {
        try {
          const locUrl = new URL(loc, upstreamOrigin)
          if (locUrl.origin === new URL(upstreamOrigin).origin) {
            const rewritten = new URL(
              locUrl.pathname + locUrl.search + locUrl.hash,
              `${url.protocol}//${url.host}`
            )
            const h = new Headers(res.headers)
            h.set('Location', rewritten.toString())
            return new Response(res.body, {
              status: res.status,
              statusText: res.statusText,
              headers: h,
            })
          }
        } catch {
          /* оставляем ответ как есть */
        }
      }
    }

    return res
  },
}
