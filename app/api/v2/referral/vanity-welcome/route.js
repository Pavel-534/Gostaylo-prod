/**
 * GET /api/v2/referral/vanity-welcome?vanity=phuket-pasha
 * Public payload for welcome banner (no PII beyond display name).
 */
import { NextResponse } from 'next/server'
import { resolveReferrerByVanityCode } from '@/lib/services/marketing/referral-vanity.service.js'
import { formatPrivacyDisplayNameForParticipant } from '@/lib/utils/name-formatter'
import { PricingService } from '@/lib/services/pricing.service'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const vanity = searchParams.get('vanity') || searchParams.get('code')
    const resolved = await resolveReferrerByVanityCode(vanity)
    if (resolved.error || !resolved.data) {
      return NextResponse.json(
        { success: false, error: resolved.error || 'VANITY_NOT_FOUND' },
        { status: resolved.status || 404 },
      )
    }
    const p = resolved.data.referrerProfile
    const general = await PricingService.getGeneralPricingSettings()
    const welcomeBonusThb = Math.round(
      Number(general?.welcome_bonus_thb ?? general?.welcomeBonusThb ?? 500) || 500,
    )
    const ambassadorName = formatPrivacyDisplayNameForParticipant(
      p?.first_name,
      p?.last_name,
      p?.email,
      'амбассадора',
    )
    return NextResponse.json({
      success: true,
      data: {
        vanity: resolved.data.vanityCode,
        ambassadorName,
        welcomeBonusThb,
        referralCode: resolved.data.code,
      },
    })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e?.message || 'VANITY_WELCOME_FAILED' },
      { status: 500 },
    )
  }
}
