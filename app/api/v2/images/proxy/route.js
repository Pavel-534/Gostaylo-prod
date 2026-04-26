import { NextResponse } from 'next/server'
import { getImageProxyUserAgent } from '@/lib/http-client-identity'

export const dynamic = 'force-dynamic'

const MAX_URL_LEN = 2048
const ALLOWED_HOST = 'images.unsplash.com'

function isAllowedUrl(urlString) {
  if (!urlString || urlString.length > MAX_URL_LEN) return false
  try {
    const u = new URL(urlString)
    if (u.protocol !== 'https:') return false
    if (u.hostname !== ALLOWED_HOST) return false
    if (!u.pathname.startsWith('/photo-')) return false
    return true
  } catch {
    return false
  }
}

/**
 * GET /api/v2/images/proxy?url=https%3A%2F%2Fimages.unsplash.com%2F...
 * Только images.unsplash.com — защита от open proxy / SSRF.
 */
export async function GET(request) {
  const raw = request.nextUrl.searchParams.get('url')
  if (!raw || !isAllowedUrl(raw)) {
    return NextResponse.json({ success: false, error: 'Invalid or disallowed URL' }, { status: 400 })
  }

  let upstream
  try {
    upstream = await fetch(raw, {
      headers: {
        Accept: 'image/avif,image/webp,image/*,*/*;q=0.8',
        'User-Agent': getImageProxyUserAgent(),
      },
      redirect: 'follow',
      cache: 'no-store',
    })
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Fetch failed' }, { status: 502 })
  }

  if (!upstream.ok) {
    return NextResponse.json({ success: false, error: 'Upstream error' }, { status: upstream.status === 404 ? 404 : 502 })
  }

  const ct = upstream.headers.get('content-type') || ''
  if (!ct.startsWith('image/')) {
    return NextResponse.json({ success: false, error: 'Not an image' }, { status: 502 })
  }

  const buf = await upstream.arrayBuffer()
  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': ct,
      'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
    },
  })
}
