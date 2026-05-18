import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { supabaseAdmin } from '@/lib/supabase'
import { buildTreasuryConversionsCsv } from '@/lib/admin/treasury-conversions-csv'

export const dynamic = 'force-dynamic'

function toIsoDayStart(day) {
  return `${day}T00:00:00.000Z`
}

function toIsoDayEnd(day) {
  return `${day}T23:59:59.999Z`
}

export async function GET(request) {
  const gate = await requireAdminStaff()
  if (gate.error) return gate.error

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let q = supabaseAdmin
    .from('ledger_entries')
    .select(
      'created_at,journal_id,description,conversion_from_currency,conversion_to_currency,conversion_rate_used,conversion_fee_thb,conversion_fee_rub,conversion_loss_thb,external_tx_reference,metadata',
    )
    .not('conversion_from_currency', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5000)

  if (from && to) {
    q = q.gte('created_at', toIsoDayStart(from)).lte('created_at', toIsoDayEnd(to))
  }

  const { data, error } = await q
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const csv = buildTreasuryConversionsCsv(data || [])
  const fileStamp = `${from || 'all'}_${to || 'all'}`
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="conversions-${fileStamp}.csv"`,
    },
  })
}
