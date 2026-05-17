import { NextResponse } from 'next/server'
import { requireAccess } from '@/lib/security/access-guard'
import { supabaseAdmin } from '@/lib/supabase'
import {
  buildComplianceRegistryCsv,
  COMPLIANCE_BOOKING_SELECT,
  filterBookingsByPaymentDate,
} from '@/lib/admin/compliance-registry-csv.js'

export const dynamic = 'force-dynamic'

const PAID_STATUSES = ['PAID_ESCROW', 'THAWED', 'READY_FOR_PAYOUT', 'COMPLETED', 'CONFIRMED']

export async function GET(request) {
  const gate = await requireAccess({ roles: ['ADMIN'] })
  if (gate.error) return gate.error

  const url = new URL(request.url)
  const bookingId = url.searchParams.get('bookingId')?.trim()
  const from = url.searchParams.get('from')?.trim()
  const to = url.searchParams.get('to')?.trim()

  const csvHeaders = {
    'Content-Type': 'text/csv; charset=utf-8',
  }

  if (bookingId) {
    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .select(COMPLIANCE_BOOKING_SELECT)
      .eq('id', bookingId)
      .maybeSingle()
    if (error || !booking) {
      return NextResponse.json({ success: false, error: 'Бронь не найдена' }, { status: 404 })
    }
    const { csv, rowCount, isEmpty } = buildComplianceRegistryCsv([booking])
    return new NextResponse(csv, {
      headers: {
        ...csvHeaders,
        'Content-Disposition': `attachment; filename="reestr-bank-${bookingId.slice(0, 8)}.csv"`,
        'X-Export-Row-Count': String(rowCount),
        'X-Export-Empty': isEmpty ? '1' : '0',
      },
    })
  }

  if (!from || !to) {
    return NextResponse.json(
      { success: false, error: 'Укажите период (from+to) или bookingId' },
      { status: 400 },
    )
  }

  const bufferFrom = new Date(`${from}T00:00:00.000Z`)
  bufferFrom.setUTCDate(bufferFrom.getUTCDate() - 120)
  const toIso = `${to}T23:59:59.999Z`

  const { data: bookings, error } = await supabaseAdmin
    .from('bookings')
    .select(COMPLIANCE_BOOKING_SELECT)
    .in('status', PAID_STATUSES)
    .gte('created_at', bufferFrom.toISOString())
    .lte('created_at', toIso)
    .order('created_at', { ascending: false })
    .limit(2000)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const filtered = filterBookingsByPaymentDate(bookings || [], from, to)
  const { csv, rowCount, isEmpty } = buildComplianceRegistryCsv(filtered, { from, to })

  return new NextResponse(csv, {
    headers: {
      ...csvHeaders,
      'Content-Disposition': `attachment; filename="reestr-bank-${from}_${to}.csv"`,
      'X-Export-Row-Count': String(rowCount),
      'X-Export-Empty': isEmpty ? '1' : '0',
    },
  })
}
