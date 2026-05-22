/**
 * GET /api/v2/referral/landing-meta/[userId]
 * Публичные данные для визитки /u/[id] (Stage 114.3 — расширенный payload).
 */

import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase'
import { buildPublicLandingPayload } from '@/lib/referral/build-public-landing-payload.js'

export const dynamic = 'force-dynamic'
export const revalidate = 60

const loadLandingCached = unstable_cache(
  async (userId) => buildPublicLandingPayload(supabaseAdmin, userId),
  ['referral-landing-meta-v1'],
  { revalidate: 60 },
)

export async function GET(request, context) {
  try {
    const params = await Promise.resolve(context.params)
    const userId = params?.userId ? String(params.userId).trim() : ''
    if (!userId) {
      return NextResponse.json({ success: false, error: 'INVALID_ID' }, { status: 400 })
    }
    if (!supabaseAdmin) {
      return NextResponse.json({ success: false, error: 'MISSING_ADMIN' }, { status: 500 })
    }

    const data = await loadLandingCached(userId)
    if (!data) {
      return NextResponse.json({ success: false, error: 'NOT_FOUND' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data })
  } catch (e) {
    return NextResponse.json({ success: false, error: e?.message || 'FAILED' }, { status: 500 })
  }
}
