import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { supabaseAdmin } from '@/lib/supabase'
import {
  buildTreasuryConversionsCsv,
  parseTreasuryConversionsCsv,
  reconcileTreasuryConversions,
} from '@/lib/admin/treasury-conversions-csv'

export const dynamic = 'force-dynamic'

function toIsoDayStart(day) {
  return `${day}T00:00:00.000Z`
}

function toIsoDayEnd(day) {
  return `${day}T23:59:59.999Z`
}

export async function GET(request) {
  const gate = await requireAdminStaff(request)
  if (gate.error) return gate.error

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!from || !to) {
    return NextResponse.json({ success: false, error: 'from and to are required' }, { status: 400 })
  }

  let q = supabaseAdmin
    .from('ledger_entries')
    .select(
      'id,journal_id,amount_thb,description,conversion_from_currency,conversion_to_currency,conversion_rate_used,conversion_fee_thb,conversion_fee_rub,conversion_loss_thb,external_tx_reference,created_at,metadata',
    )
    .not('conversion_from_currency', 'is', null)
    .gte('created_at', toIsoDayStart(from))
    .lte('created_at', toIsoDayEnd(to))
    .order('created_at', { ascending: false })
    .limit(5000)

  const { data, error } = await q
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const ledgerRows = data || []
  const csvText = buildTreasuryConversionsCsv(ledgerRows)
  const parsedCsv = parseTreasuryConversionsCsv(csvText)
  const result = reconcileTreasuryConversions(ledgerRows, parsedCsv)

  return NextResponse.json({
    success: true,
    data: {
      period: { from, to },
      ...result,
    },
  })
}
