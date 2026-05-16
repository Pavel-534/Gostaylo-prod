import { NextResponse } from 'next/server'
import { requireAccess } from '@/lib/security/access-guard'
import { supabaseAdmin } from '@/lib/supabase'
import { computeBookingPaymentLedgerLegs } from '@/lib/services/ledger.service.js'
import { complianceToCsv } from '@/lib/admin/compliance-export-csv.js'
import { toFiscalKassaPayload } from '@/lib/pricing-engine/snapshot-adapter.js'

export const dynamic = 'force-dynamic'

function buildRow(booking, legs) {
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
    created_at: booking.created_at,
  }
}

function esc(v) {
  const s = v == null ? '' : String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function multiBookingCsv(rows) {
  const header = [
    'booking_id',
    'status',
    'created_at',
    'guest_total_thb',
    'subtotal_thb',
    'partner_net_thb',
    'fiscal_status',
    'fiscal_receipt_id',
  ]
  const lines = [header.join(',')]
  for (const data of rows) {
    const fb = data.final_breakdown || {}
    const meta = data.fiscal_metadata || {}
    lines.push(
      [
        data.booking_id,
        data.status,
        data.created_at,
        fb.guest_total_thb ?? fb.guest_total,
        fb.subtotal_thb ?? fb.subtotal,
        fb.partner_net_thb ?? fb.partner_net,
        meta.status,
        meta.receipt_id ?? meta.receiptId,
      ]
        .map(esc)
        .join(','),
    )
  }
  return lines.join('\n')
}

export async function GET(request) {
  const gate = await requireAccess({ roles: ['ADMIN'] })
  if (gate.error) return gate.error

  const url = new URL(request.url)
  const bookingId = url.searchParams.get('bookingId')?.trim()
  const from = url.searchParams.get('from')?.trim()
  const to = url.searchParams.get('to')?.trim()

  if (bookingId) {
    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .maybeSingle()
    if (error || !booking) {
      return NextResponse.json({ success: false, error: 'not_found' }, { status: 404 })
    }
    const data = buildRow(booking, computeBookingPaymentLedgerLegs(booking))
    const csv = complianceToCsv(data)
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="compliance-${bookingId}.csv"`,
      },
    })
  }

  if (!from || !to) {
    return NextResponse.json(
      { success: false, error: 'bookingId or from+to (YYYY-MM-DD) required' },
      { status: 400 },
    )
  }

  const fromIso = `${from}T00:00:00.000Z`
  const toIso = `${to}T23:59:59.999Z`

  const { data: bookings, error } = await supabaseAdmin
    .from('bookings')
    .select('*')
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
    .in('status', ['PAID_ESCROW', 'THAWED', 'READY_FOR_PAYOUT', 'COMPLETED'])
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const rows = (bookings || []).map((b) => buildRow(b, computeBookingPaymentLedgerLegs(b)))
  const csv = multiBookingCsv(rows)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="compliance-registry-${from}_${to}.csv"`,
    },
  })
}
