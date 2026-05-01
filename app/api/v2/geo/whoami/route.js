/**
 * GET /api/v2/geo/whoami
 *
 * Возвращает { country, region, city, source } — определяет локацию клиента.
 *
 * Стратегия:
 *   1) Cloudflare / proxy headers (cf-ipcountry, x-vercel-ip-country, x-country-code).
 *   2) Внешний IP-API (ipapi.co/{ip}/country) — бесплатный без ключа, public IP.
 *   3) Возврат null — клиент сам сделает Accept-Language fallback.
 *
 * Edge-runtime для минимальной задержки.
 *
 * @created 2026-02 Global DB Sprint — Smart Geolocation
 */

export const runtime = 'edge'

function getClientIp(req) {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') || ''
}

function getCountryFromHeaders(req) {
  return (
    req.headers.get('cf-ipcountry') ||
    req.headers.get('x-vercel-ip-country') ||
    req.headers.get('x-country-code') ||
    ''
  ).toUpperCase()
}

async function lookupViaIpApi(ip) {
  try {
    const url = ip ? `https://ipapi.co/${ip}/country/` : 'https://ipapi.co/country/'
    const r = await fetch(url, {
      headers: { 'User-Agent': 'gostaylo-geo/1.0' },
      // Edge: short timeout via AbortController
      signal: AbortSignal.timeout(2000),
    })
    if (!r.ok) return ''
    const txt = (await r.text()).trim().toUpperCase()
    return /^[A-Z]{2}$/.test(txt) ? txt : ''
  } catch {
    return ''
  }
}

export async function GET(req) {
  // 1) Try edge proxy headers (instant)
  let country = getCountryFromHeaders(req)
  let source = country ? 'header' : ''

  // 2) IP-API lookup if no header
  if (!country) {
    const ip = getClientIp(req)
    country = await lookupViaIpApi(ip)
    source = country ? 'ipapi' : ''
  }

  if (!country) {
    return new Response(JSON.stringify({ country: null, source: 'unknown' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  }

  return new Response(JSON.stringify({ country, source }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      // Кэшируем у клиента на 1 час — не у CDN, чтобы IP оставался релевантным
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
