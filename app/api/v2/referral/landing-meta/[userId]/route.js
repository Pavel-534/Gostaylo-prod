/**
 * GET /api/v2/referral/landing-meta/[userId]
 * Публичные данные для визитки /u/[id] (Stage 114.3 — расширенный payload).
 * Stage 202.6 — loader SSOT in get-cached-public-landing-meta (no RSC self-HTTP).
 */

import { NextResponse } from 'next/server'
import { getCachedPublicLandingMeta } from '@/lib/referral/get-cached-public-landing-meta.js'

export const dynamic = 'force-dynamic'
export const revalidate = 60

export async function GET(request, context) {
  try {
    const params = await Promise.resolve(context.params)
    const userId = params?.userId ? String(params.userId).trim() : ''
    if (!userId) {
      return NextResponse.json({ success: false, error: 'INVALID_ID' }, { status: 400 })
    }

    const data = await getCachedPublicLandingMeta(userId)
    if (!data) {
      return NextResponse.json({ success: false, error: 'NOT_FOUND' }, { status: 404 })
    }

    return NextResponse.json(
      { success: true, data },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
          'Vercel-CDN-Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      },
    )
  } catch (e) {
    return NextResponse.json({ success: false, error: e?.message || 'FAILED' }, { status: 500 })
  }
}
