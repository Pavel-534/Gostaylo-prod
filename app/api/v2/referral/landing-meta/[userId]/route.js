/**
 * GET /api/v2/referral/landing-meta/[userId]
 * Публичные данные для визитки /u/[id]: реферальный код, tier (публичное имя).
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { formatPrivacyDisplayName } from '@/lib/utils/name-formatter'
import { buildAmbassadorLandingUrl, ambassadorLandingShortLabel } from '@/lib/referral/public-landing-url'

export const dynamic = 'force-dynamic'

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

    const { data: rc } = await supabaseAdmin
      .from('referral_codes')
      .select('code, is_active')
      .eq('user_id', userId)
      .maybeSingle()

    const code =
      rc?.is_active !== false && rc?.code ? String(rc.code).trim().toUpperCase() : null

    const { data: p } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, referral_tier_name')
      .eq('id', userId)
      .maybeSingle()

    if (!p?.id) {
      return NextResponse.json({ success: false, error: 'NOT_FOUND' }, { status: 404 })
    }

    const tierLabel = String(p.referral_tier_name || '').trim()

    return NextResponse.json({
      success: true,
      data: {
        userId,
        referralCode: code,
        displayName: formatPrivacyDisplayName(p.first_name, p.last_name),
        tierLabel,
        badgeLabel: tierLabel || 'Ambassador',
        landingUrl: buildAmbassadorLandingUrl(userId),
        landingShortLabel: ambassadorLandingShortLabel(userId),
      },
    })
  } catch (e) {
    return NextResponse.json({ success: false, error: e?.message || 'FAILED' }, { status: 500 })
  }
}
