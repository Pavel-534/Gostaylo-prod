/**
 * GET /api/v2/recommendations/for-you — «Для вас» feed (Stage 167.2).
 */

import { NextResponse } from 'next/server'
import { rateLimitCheck } from '@/lib/rate-limit'
import { verifySessionFromCookies } from '@/lib/auth/session-from-cookie'
import { getForYouRecommendations } from '@/lib/recommendations/personalization-v1.service'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const rl = await rateLimitCheck(request, 'search')
  if (rl) {
    return NextResponse.json(rl.body, { status: rl.status, headers: rl.headers })
  }

  const { searchParams } = new URL(request.url)
  const where = searchParams.get('where') || searchParams.get('location') || null
  const limitRaw = parseInt(searchParams.get('limit'), 10)

  let userId = null
  try {
    const session = await verifySessionFromCookies()
    if (session.ok) {
      userId = session.payload?.userId || session.payload?.sub || null
    }
  } catch {
    userId = null
  }

  try {
    const { listings, meta } = await getForYouRecommendations({
      userId,
      where: where && where !== 'all' ? where : null,
      limit: limitRaw,
    })

    return NextResponse.json({
      success: true,
      listings,
      meta: {
        ...meta,
        authenticated: Boolean(userId),
      },
    })
  } catch (error) {
    console.error('[for-you API]', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
