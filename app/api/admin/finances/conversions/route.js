import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { supabaseAdmin } from '@/lib/supabase'
import { getRawRateMap } from '@/lib/services/pricing/pricing-fx-helpers.js'
import { mapLedgerRowToConversionDto } from '@/lib/admin/treasury-conversions-csv'

export const dynamic = 'force-dynamic'

const ACC = {
  processingPot: 'la-sys-processing-pot',
  fxLosses: 'la-sys-fx-conversion-losses',
}

function round2(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(x * 100) / 100
}

function toIsoDayStart(day) {
  return `${day}T00:00:00.000Z`
}

function toIsoDayEnd(day) {
  return `${day}T23:59:59.999Z`
}

function normalizeCurrency(code) {
  return String(code || '').trim().toUpperCase()
}

function thbToCurrency(amountThb, rateToThb) {
  const thb = Number(amountThb)
  const rate = Number(rateToThb)
  if (!Number.isFinite(thb) || !Number.isFinite(rate) || rate <= 0) return null
  return round2(thb / rate)
}

export async function GET(request) {
  const gate = await requireAdminStaff()
  if (gate.error) return gate.error

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const operationType = String(searchParams.get('operationType') || '').trim().toUpperCase()
  const currency = normalizeCurrency(searchParams.get('currency'))
  const limitRaw = Number(searchParams.get('limit'))
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 5000) : 200

  let periodFrom = null
  let periodTo = null
  if (from && to) {
    periodFrom = toIsoDayStart(from)
    periodTo = toIsoDayEnd(to)
  }

  let convQuery = supabaseAdmin
    .from('ledger_entries')
    .select(
      'id,journal_id,amount_thb,description,conversion_from_currency,conversion_to_currency,conversion_rate_used,conversion_fee_thb,conversion_fee_rub,conversion_loss_thb,external_tx_reference,created_at,metadata',
    )
    .not('conversion_from_currency', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (periodFrom && periodTo) {
    convQuery = convQuery.gte('created_at', periodFrom).lte('created_at', periodTo)
  }
  if (operationType) {
    convQuery = convQuery.contains('metadata', { operation_type: operationType })
  }
  if (currency) {
    convQuery = convQuery.or(
      `conversion_from_currency.eq.${currency},conversion_to_currency.eq.${currency}`,
    )
  }

  const { data: conversions, error: convError } = await convQuery
  if (convError) {
    return NextResponse.json({ success: false, error: convError.message }, { status: 500 })
  }

  let payoutsQuery = supabaseAdmin
    .from('payouts')
    .select('gross_amount, created_at')
    .in('status', ['PAID', 'COMPLETED'])
  if (periodFrom && periodTo) {
    payoutsQuery = payoutsQuery.gte('created_at', periodFrom).lte('created_at', periodTo)
  }
  const { data: payouts, error: payoutsError } = await payoutsQuery
  if (payoutsError) {
    return NextResponse.json({ success: false, error: payoutsError.message }, { status: 500 })
  }

  const recon = await (async () => {
    let q = supabaseAdmin
      .from('ledger_entries')
      .select('side,amount_thb,ledger_accounts!inner(code),created_at')
      .eq('ledger_accounts.code', 'GUEST_PAYMENT_CLEARING')
    if (periodFrom && periodTo) q = q.gte('created_at', periodFrom).lte('created_at', periodTo)
    return q
  })()
  if (recon.error) {
    return NextResponse.json({ success: false, error: recon.error.message }, { status: 500 })
  }

  const acceptedGuestThb = (recon.data || []).reduce((sum, row) => {
    if (row.side !== 'DEBIT') return sum
    return sum + (Number(row.amount_thb) || 0)
  }, 0)

  const paidOutThb = (payouts || []).reduce((sum, row) => sum + (Number(row.gross_amount) || 0), 0)
  const conversionLossesThb = (conversions || []).reduce((sum, row) => {
    const explicitLoss = Number(row.conversion_loss_thb) || 0
    const feeLoss = Number(row.conversion_fee_thb) || 0
    return sum + explicitLoss + feeLoss
  }, 0)

  const netMarginThb = acceptedGuestThb - paidOutThb - conversionLossesThb
  const netMarginPct =
    acceptedGuestThb > 0 ? round2((netMarginThb / acceptedGuestThb) * 100) : null
  let acceptedGuestRub = null
  try {
    const rawMap = await getRawRateMap()
    acceptedGuestRub = thbToCurrency(acceptedGuestThb, rawMap?.RUB)
  } catch {
    acceptedGuestRub = null
  }

  return NextResponse.json({
    success: true,
    data: {
      period: { from: periodFrom, to: periodTo },
      filters: { operationType: operationType || null, currency: currency || null },
      margin: {
        acceptedGuestThb: round2(acceptedGuestThb),
        acceptedGuestRub,
        paidOutThb: round2(paidOutThb),
        conversionLossesThb: round2(conversionLossesThb),
        netMarginThb: round2(netMarginThb),
        netMarginPct,
      },
      conversions: (conversions || []).map((r) => mapLedgerRowToConversionDto(r)),
    },
  })
}

export async function POST(request) {
  const gate = await requireAdminStaff()
  if (gate.error) return gate.error

  const body = await request.json().catch(() => ({}))
  const operationType = String(body.operationType || '').trim().toUpperCase()
  const fromCurrency = normalizeCurrency(body.fromCurrency)
  const toCurrency = normalizeCurrency(body.toCurrency)
  const amountFrom = Number(body.amountFrom)
  const amountTo = Number(body.amountTo)
  const rateUsed = Number(body.rateUsed)
  const conversionFeeThb = round2(body.conversionFeeThb)
  const conversionFeeRub = round2(body.conversionFeeRub)
  const conversionLossThb = round2(body.conversionLossThb)
  const externalTxReference = String(body.externalTxReference || '').trim() || null
  const note = String(body.note || '').trim()

  if (!operationType || !fromCurrency || !toCurrency) {
    return NextResponse.json(
      { success: false, error: 'operationType/fromCurrency/toCurrency are required' },
      { status: 400 },
    )
  }
  if (!Number.isFinite(amountFrom) || amountFrom <= 0) {
    return NextResponse.json({ success: false, error: 'amountFrom must be > 0' }, { status: 400 })
  }
  if (!Number.isFinite(amountTo) || amountTo <= 0) {
    return NextResponse.json({ success: false, error: 'amountTo must be > 0' }, { status: 400 })
  }
  if (!Number.isFinite(rateUsed) || rateUsed <= 0) {
    return NextResponse.json({ success: false, error: 'rateUsed must be > 0' }, { status: 400 })
  }

  const totalImpactThb = round2(conversionFeeThb + conversionLossThb)
  if (totalImpactThb <= 0) {
    return NextResponse.json(
      { success: false, error: 'conversionFeeThb + conversionLossThb must be > 0' },
      { status: 400 },
    )
  }

  const conversionId = `cnv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const journalId = `lj-fx-conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const idempotencyKey = `treasury_conversion:${conversionId}`
  const now = new Date().toISOString()

  const journalPayload = {
    id: journalId,
    booking_id: null,
    event_type: 'TREASURY_CONVERSION_RECORDED',
    idempotency_key: idempotencyKey,
    metadata: {
      conversion_id: conversionId,
      operation_type: operationType,
      from_currency: fromCurrency,
      to_currency: toCurrency,
      amount_from: round2(amountFrom),
      amount_to: round2(amountTo),
      rate_used: rateUsed,
      external_tx_reference: externalTxReference,
      note: note || null,
      created_by: gate.profile?.id || null,
    },
    created_at: now,
  }

  const { error: journalError } = await supabaseAdmin.from('ledger_journals').insert(journalPayload)
  if (journalError) {
    return NextResponse.json({ success: false, error: journalError.message }, { status: 500 })
  }

  const commonMeta = {
    conversion_id: conversionId,
    operation_type: operationType,
    amount_from: round2(amountFrom),
    amount_to: round2(amountTo),
    rate_used: rateUsed,
    external_tx_reference: externalTxReference,
    note: note || null,
  }

  const entries = [
    {
      id: `le-${journalId}-dr-loss`,
      journal_id: journalId,
      account_id: ACC.fxLosses,
      side: 'DEBIT',
      amount_thb: totalImpactThb,
      description: note || `Treasury conversion loss (${fromCurrency}→${toCurrency})`,
      conversion_from_currency: fromCurrency,
      conversion_to_currency: toCurrency,
      conversion_rate_used: rateUsed,
      conversion_fee_thb: conversionFeeThb,
      conversion_fee_rub: conversionFeeRub > 0 ? conversionFeeRub : null,
      external_tx_reference: externalTxReference,
      conversion_loss_thb: conversionLossThb,
      metadata: commonMeta,
      created_at: now,
    },
    {
      id: `le-${journalId}-cr-pot`,
      journal_id: journalId,
      account_id: ACC.processingPot,
      side: 'CREDIT',
      amount_thb: totalImpactThb,
      description: `Treasury conversion offset (${fromCurrency}→${toCurrency})`,
      metadata: commonMeta,
      created_at: now,
    },
  ]

  const { error: entriesError } = await supabaseAdmin.from('ledger_entries').insert(entries)
  if (entriesError) {
    await supabaseAdmin.from('ledger_journals').delete().eq('id', journalId)
    return NextResponse.json({ success: false, error: entriesError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    data: {
      conversionId,
      journalId,
      totalImpactThb,
    },
  })
}
