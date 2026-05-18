/**
 * POST /api/v2/partner/payouts/preview-batch
 * Stage 100.8 — batch payout preview (same SSOT as GET …/preview).
 *
 * Body: { amountsThb: number[], payoutProfileId?: string }
 */

import { NextResponse } from 'next/server'
import { getUserIdFromSession } from '@/lib/services/session-service'
import { PayoutRailsService } from '@/lib/services/payout-rails.service'
import { computePayoutFeeThb } from '@/lib/partner/partner-payout-fx.js'
import {
  mapPartnerPayoutPreviewData,
  payoutPreviewAmountKey,
} from '@/lib/partner/partner-payout-preview-api.js'

export const dynamic = 'force-dynamic'

const MAX_AMOUNTS = 50

export async function POST(request) {
  try {
    const sessionUserId = await getUserIdFromSession()
    if (!sessionUserId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const rawAmounts = Array.isArray(body.amountsThb) ? body.amountsThb : []
    const payoutProfileId = body.payoutProfileId

    const amounts = [
      ...new Set(
        rawAmounts
          .map((a) => Math.round((Number(a) || 0) * 100) / 100)
          .filter((a) => a > 0),
      ),
    ].slice(0, MAX_AMOUNTS)

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

    /** @type {Record<string, object>} */
    const byAmountKey = {}

    for (const amountThb of amounts) {
      const math = await computePayoutFeeThb(amountThb, profile.method)
      byAmountKey[payoutPreviewAmountKey(amountThb)] = mapPartnerPayoutPreviewData(math, {
        requestedAmountThb: amountThb,
        profileId: profile.id,
        methodName: profile.method?.name || null,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        byAmountKey,
        profileId: profile.id,
        methodName: profile.method?.name || null,
      },
    })
  } catch (error) {
    console.error('[PAYOUT PREVIEW BATCH]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
