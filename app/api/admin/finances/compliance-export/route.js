import { NextResponse } from 'next/server'
import { requireAccess } from '@/lib/security/access-guard'
import { supabaseAdmin } from '@/lib/supabase'
import { buildComplianceRegistryCsv } from '@/lib/admin/compliance-registry-csv.js'

export const dynamic = 'force-dynamic'

const BOOKING_SELECT = `
  *,
  listings (
    category_slug,
    categories (
      slug,
      wizard_profile
    )
  )
`

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
      .select(BOOKING_SELECT)
      .eq('id', bookingId)
      .maybeSingle()
    if (error || !booking) {
      return NextResponse.json({ success: false, error: 'not_found' }, { status: 404 })
    }
    const csv = buildComplianceRegistryCsv([booking])
    return new NextResponse(csv, {
      headers: {
        ...csvHeaders,
        'Content-Disposition': `attachment; filename="compliance-registry-${bookingId}.csv"`,
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
    .select(BOOKING_SELECT)
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
    .in('status', ['PAID_ESCROW', 'THAWED', 'READY_FOR_PAYOUT', 'COMPLETED'])
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const csv = buildComplianceRegistryCsv(bookings || [])
  return new NextResponse(csv, {
    headers: {
      ...csvHeaders,
      'Content-Disposition': `attachment; filename="compliance-registry-${from}_${to}.csv"`,
    },
  })
}
