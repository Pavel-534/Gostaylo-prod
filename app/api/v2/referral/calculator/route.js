import { NextResponse } from 'next/server'
import { computePublicReferralCalculatorEstimate } from '@/lib/services/marketing/referral-public-calculator.service.js'

export const dynamic = 'force-dynamic'

/**
 * GET /api/v2/referral/calculator
 * Public marketing estimate — no taxes, acquiring, or platform retained.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const subtotalThb = searchParams.get('subtotalThb') ?? searchParams.get('subtotal')
    const guestServiceFeePercent =
      searchParams.get('guestFeePercent') ?? searchParams.get('guestServiceFeePercent')
    const guestPaymentMode =
      searchParams.get('guestPaymentMode') ?? searchParams.get('paymentMode') ?? 'THB'
    const fxMarkupPct = searchParams.get('fxMarkupPct')

    const data = await computePublicReferralCalculatorEstimate({
      subtotalThb,
      guestServiceFeePercent,
      guestPaymentMode,
      fxMarkupPct: fxMarkupPct != null ? Number(fxMarkupPct) : undefined,
    })

    return NextResponse.json({ success: true, data })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: 'CALCULATOR_FAILED', message: e?.message || 'failed' },
      { status: 500 },
    )
  }
}
