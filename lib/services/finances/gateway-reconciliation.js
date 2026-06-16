/**
 * Stage 153.3 — Gateway vs Ledger reconciliation MVP (24h window).
 * Compares acquirer-side payment intents (PAID) with ledger capture (DEBIT GUEST_PAYMENT_CLEARING).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { recordCriticalSignal } from '@/lib/critical-telemetry.js'
import { round2 } from '@/lib/services/ledger/ledger-shared.js'

const DRIFT_TOLERANCE_THB = 0.01
const WINDOW_HOURS = 24

/**
 * @param {{ windowHours?: number, driftToleranceThb?: number }} [opts]
 */
export async function runGatewayLedgerReconciliation(opts = {}) {
  const windowHours = Number(opts.windowHours) > 0 ? Number(opts.windowHours) : WINDOW_HOURS
  const driftTolerance = Number(opts.driftToleranceThb) ?? DRIFT_TOLERANCE_THB
  const sinceIso = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString()

  if (!supabaseAdmin) {
    return { ok: false, error: 'no_db', sinceIso, windowHours }
  }

  const { data: intents, error: piErr } = await supabaseAdmin
    .from('payment_intents')
    .select('id, amount_thb, confirmed_at, updated_at')
    .eq('status', 'PAID')
    .gte('confirmed_at', sinceIso)

  if (piErr) {
    return { ok: false, error: piErr.message, sinceIso, windowHours }
  }

  let intentsSumThb = 0
  for (const row of intents || []) {
    intentsSumThb += Number(row.amount_thb) || 0
  }
  intentsSumThb = round2(intentsSumThb)

  const { data: clearingAcct, error: acctErr } = await supabaseAdmin
    .from('ledger_accounts')
    .select('id')
    .eq('code', 'GUEST_PAYMENT_CLEARING')
    .maybeSingle()

  if (acctErr || !clearingAcct?.id) {
    return { ok: false, error: acctErr?.message || 'clearing_account_missing', sinceIso, windowHours }
  }

  const { data: journals, error: jErr } = await supabaseAdmin
    .from('ledger_journals')
    .select('id')
    .eq('event_type', 'BOOKING_PAYMENT_CAPTURED')
    .gte('created_at', sinceIso)

  if (jErr) {
    return { ok: false, error: jErr.message, sinceIso, windowHours }
  }

  const journalIds = (journals || []).map((j) => j.id).filter(Boolean)
  let ledgerSumThb = 0

  if (journalIds.length) {
    const { data: entries, error: eErr } = await supabaseAdmin
      .from('ledger_entries')
      .select('amount_thb, side')
      .in('journal_id', journalIds)
      .eq('account_id', clearingAcct.id)
      .eq('side', 'DEBIT')

    if (eErr) {
      return { ok: false, error: eErr.message, sinceIso, windowHours }
    }

    for (const e of entries || []) {
      ledgerSumThb += Number(e.amount_thb) || 0
    }
  }

  ledgerSumThb = round2(ledgerSumThb)
  const driftThb = round2(intentsSumThb - ledgerSumThb)
  const withinTolerance = Math.abs(driftThb) <= driftTolerance

  const result = {
    ok: true,
    sinceIso,
    windowHours,
    intentsCount: (intents || []).length,
    captureJournalCount: journalIds.length,
    intentsSumThb,
    ledgerSumThb,
    driftThb,
    withinTolerance,
    driftToleranceThb: driftTolerance,
  }

  if (!withinTolerance) {
    recordCriticalSignal('GATEWAY_LEDGER_DRIFT', {
      tag: '[GATEWAY_RECONCILE]',
      threshold: 1,
      windowMs: 60 * 60 * 1000,
      detailLines: [
        `window=${windowHours}h`,
        `intents_sum_thb=${intentsSumThb}`,
        `ledger_clearing_debit_thb=${ledgerSumThb}`,
        `drift_thb=${driftThb}`,
        `intents_count=${result.intentsCount}`,
        `capture_journals=${result.captureJournalCount}`,
      ],
      persistDetail: {
        sinceIso,
        intentsSumThb,
        ledgerSumThb,
        driftThb,
        intentsCount: result.intentsCount,
        captureJournalCount: result.captureJournalCount,
      },
    })
    result.alertSent = true
  }

  return result
}
