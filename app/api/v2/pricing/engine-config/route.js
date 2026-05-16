/**
 * GET /api/v2/pricing/engine-config — public rounding mode for checkout/PDP (no internal %).
 */

import { NextResponse } from 'next/server'
import { isPricingEngineV2Enabled } from '@/lib/pricing-engine/feature-flag.js'
import { ROUNDING_MODE_INTEGER, ROUNDING_MODE_POT10 } from '@/lib/booking-guest-rounding.js'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const v2Enabled = await isPricingEngineV2Enabled()
    return NextResponse.json({
      success: true,
      data: {
        pricingEngineV2Enabled: v2Enabled,
        roundingMode: v2Enabled ? ROUNDING_MODE_INTEGER : ROUNDING_MODE_POT10,
      },
    })
  } catch (e) {
    return NextResponse.json(
      {
        success: true,
        data: {
          pricingEngineV2Enabled: false,
          roundingMode: ROUNDING_MODE_POT10,
        },
      },
      { status: 200 },
    )
  }
}
