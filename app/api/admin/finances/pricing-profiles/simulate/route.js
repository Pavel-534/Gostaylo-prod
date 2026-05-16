import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { computeFinalBreakdown } from '@/lib/pricing-engine/compute-breakdown.js'
import { toPartnerVisibleBreakdown, toFiscalKassaPayload } from '@/lib/pricing-engine/snapshot-adapter.js'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const gate = await requireAdminStaff()
  if (gate.error) return gate.error

  const body = await request.json().catch(() => ({}))
  const subtotal = Math.round(Number(body.subtotal_thb) || 0)
  const profile = body.profile
  if (!profile?.id) {
    return NextResponse.json({ success: false, error: 'profile required' }, { status: 400 })
  }

  try {
    const breakdown = computeFinalBreakdown({
      subtotal_thb: subtotal,
      profile,
      payment_currency: body.payment_currency || 'THB',
      listing_base_currency: body.listing_base_currency || 'THB',
      raw_fx_rate_map: body.raw_fx_rate_map || { THB: 1, RUB: Number(body.rub_to_thb) || 0.45 },
    })
    return NextResponse.json({
      success: true,
      data: {
        breakdown,
        partner_visible: toPartnerVisibleBreakdown(breakdown),
        fiscal_preview: toFiscalKassaPayload(breakdown),
      },
    })
  } catch (e) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 400 })
  }
}
