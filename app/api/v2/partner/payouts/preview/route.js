/**
 * GET /api/v2/partner/payouts/preview?amountThb=&payoutProfileId=
 * Stage 100.6 — honest payout preview (THB fee + payout currency FX).
 */

import { NextResponse } from 'next/server'
import { getUserIdFromSession } from '@/lib/services/session-service'
import { PayoutRailsService } from '@/lib/services/payout-rails.service'
import { getPartnerBalance } from '@/lib/services/escrow/balance.service.js'
import { computePayoutFeeThb } from '@/lib/partner/partner-payout-fx.js'
import { mapPartnerPayoutPreviewData } from '@/lib/partner/partner-payout-preview-api.js'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const sessionUserId = await getUserIdFromSession()
    if (!sessionUserId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const amountThb = Number(searchParams.get('amountThb'))
    const payoutProfileId = searchParams.get('payoutProfileId')

    const { balance } = await getPartnerBalance(sessionUserId)
    const availableThb = balance?.availableBalanceThb ?? balance?.availableBalance ?? 0
    const baseThb =
      Number.isFinite(amountThb) && amountThb > 0 ? amountThb : availableThb

    let profile = null
    if (payoutProfileId) {
      const profiles = await PayoutRailsService.listPartnerPayoutProfiles(sessionUserId)
      profile = profiles.find((p) => p.id === payoutProfileId) || null
    } else {
      profile = await PayoutRailsService.getPartnerDefaultPayoutProfile(sessionUserId)
    }

    if (!profile) {
      return NextResponse.json({ success: false, error: 'NO_PAYOUT_PROFILE' }, { status: 400 })
    }

    const math = await computePayoutFeeThb(Math.min(baseThb, availableThb), profile.method)
    if (math?.error) {
      return NextResponse.json({ success: false, error: math.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data: mapPartnerPayoutPreviewData(math, {
        availableThb,
        grossAvailableThb: balance?.grossAvailableBalanceThb ?? availableThb,
        pendingPayoutReserveThb: balance?.pendingPayoutReserveThb ?? 0,
        profileId: profile.id,
        methodName: profile.method?.name || null,
      }),
    })
  } catch (error) {
    console.error('[PAYOUT PREVIEW]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
