import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { supabaseAdmin } from '@/lib/supabase'
import { toFiscalKassaPayload } from '@/lib/pricing-engine/snapshot-adapter.js'
import { computeBookingPaymentLedgerLegs } from '@/lib/services/ledger.service.js'
import {
  buildComplianceRegistryCsv,
  COMPLIANCE_BOOKING_SELECT,
} from '@/lib/admin/compliance-registry-csv.js'

export const dynamic = 'force-dynamic'

function buildCompliancePayload(booking, legs) {
  const snap = booking.pricing_snapshot || {}
  const fb = snap.final_breakdown || null
  return {
    booking_id: booking.id,
    status: booking.status,
    pricing_snapshot_v: snap.v ?? 1,
    final_breakdown: fb,
    fee_split_v2: snap.fee_split_v2 || null,
    ledger_legs: legs,
    fiscal: snap.fiscal_kassa_preview || (fb ? toFiscalKassaPayload(fb) : null),
    fiscal_metadata: booking.metadata?.fiscal || null,
    rounding_pot_thb: booking.rounding_diff_pot,
  }
}

export async function GET(request, { params }) {
  const gate = await requireAdminStaff()
  if (gate.error) return gate.error

  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .select(COMPLIANCE_BOOKING_SELECT)
    .eq('id', params.bookingId)
    .maybeSingle()
  if (error || !booking) {
    return NextResponse.json({ success: false, error: 'not_found' }, { status: 404 })
  }

  const legs = computeBookingPaymentLedgerLegs(booking)
  const data = buildCompliancePayload(booking, legs)

  const format = new URL(request.url).searchParams.get('format')
  if (format === 'csv') {
    const { csv } = buildComplianceRegistryCsv([booking])
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="compliance-${booking.id}.csv"`,
      },
    })
  }

  return NextResponse.json({ success: true, data })
}
