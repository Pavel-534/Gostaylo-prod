/**
 * Stage 110.3 — MVP ledger reconciliation (guest clearing vs capture distribution).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { round2 } from '@/lib/services/ledger/ledger-shared.js'
import { sumNetBalancesByAccountIds } from '@/lib/services/ledger/ledger-balance.js'

/**
 * MVP сверка «Cash» = счёт **GUEST_PAYMENT_CLEARING** (вход гостевых средств).
 * @see legacy comment in ledger.service.js (110.3 — logic unchanged)
 */
export async function runReconciliationMvp() {
  const { data: entries, error } = await supabaseAdmin
    .from('ledger_entries')
    .select('journal_id, account_id, side, amount_thb')
  if (error) throw new Error(error.message)

  const accountIds = [...new Set((entries || []).map((e) => e.account_id).filter(Boolean))]
  const { data: accounts, error: aErr } = await supabaseAdmin
    .from('ledger_accounts')
    .select('id, code')
    .in('id', accountIds)
  if (aErr) throw new Error(aErr.message)
  const codeById = new Map((accounts || []).map((a) => [a.id, a.code]))

  const rowsByJournal = new Map()
  for (const e of entries || []) {
    const jid = e.journal_id
    if (!jid) continue
    if (!rowsByJournal.has(jid)) rowsByJournal.set(jid, [])
    rowsByJournal.get(jid).push(e)
  }

  let guestClearingDebitsThb = 0
  let distributionCreditsThb = 0

  const byJournal = new Map()
  for (const e of entries || []) {
    const amt = round2(e.amount_thb)
    if (!byJournal.has(e.journal_id)) byJournal.set(e.journal_id, { dr: 0, cr: 0 })
    const j = byJournal.get(e.journal_id)
    if (e.side === 'DEBIT') j.dr += amt
    else j.cr += amt
  }

  for (const [, rows] of rowsByJournal) {
    let guestDrThisJournal = 0
    for (const e of rows) {
      const amt = round2(e.amount_thb)
      const code = codeById.get(e.account_id) || ''
      if (code === 'GUEST_PAYMENT_CLEARING' && e.side === 'DEBIT') {
        guestDrThisJournal += amt
      }
    }
    if (guestDrThisJournal <= 0.02) continue

    guestClearingDebitsThb += guestDrThisJournal
    for (const e of rows) {
      const amt = round2(e.amount_thb)
      const code = codeById.get(e.account_id) || ''
      if (e.side === 'CREDIT' && code !== 'GUEST_PAYMENT_CLEARING' && code !== 'PARTNER_PAYOUTS_SETTLED') {
        distributionCreditsThb += amt
      }
    }
  }

  let unbalancedJournals = 0
  for (const v of byJournal.values()) {
    if (Math.abs(round2(v.dr - v.cr)) > 0.02) unbalancedJournals += 1
  }

  const deltaThb = round2(guestClearingDebitsThb - distributionCreditsThb)
  const marginLeakage = Math.abs(deltaThb) > 0.02 || unbalancedJournals > 0

  let payoutSelfCheck = null
  try {
    const { data: openRows, error: openErr } = await supabaseAdmin
      .from('payouts')
      .select('gross_amount, amount')
      .in('status', ['PENDING', 'PROCESSING'])
    if (!openErr) {
      let openGrossSum = 0
      for (const r of openRows || []) {
        const g = parseFloat(r.gross_amount) || parseFloat(r.amount) || 0
        openGrossSum += round2(g)
      }
      openGrossSum = round2(openGrossSum)

      const { data: partnerAccounts, error: paErr } = await supabaseAdmin
        .from('ledger_accounts')
        .select('id')
        .eq('code', 'PARTNER_EARNINGS')
      if (!paErr) {
        const partnerIds = (partnerAccounts || []).map((r) => r.id)
        const balances = await sumNetBalancesByAccountIds(partnerIds)
        let partnerNet = 0
        for (const pid of partnerIds) {
          partnerNet += balances[pid] || 0
        }
        partnerNet = round2(partnerNet)
        const deltaOpenVsLedgerThb = round2(openGrossSum - partnerNet)
        const toleranceThb = 0.02
        const equalsLedgerWithinTolerance = Math.abs(deltaOpenVsLedgerThb) <= toleranceThb
        payoutSelfCheck = {
          openPipelineGrossThb: openGrossSum,
          partnerEarningsLedgerNetThb: partnerNet,
          deltaOpenVsLedgerThb,
          equalsLedgerWithinTolerance,
          toleranceThb,
          note:
            'Инвариант «сумма открытых выплат = нетто PARTNER_EARNINGS» выполняется не всегда (часть обязательств не в заявках, мультивалюта, legacy). Сверка — smoke; расхождение не означает Margin Leakage.',
        }
        if (!equalsLedgerWithinTolerance) {
          console.warn('[LedgerService.runReconciliationMvp] payout self-check', {
            openPipelineGrossThb: openGrossSum,
            partnerEarningsLedgerNetThb: partnerNet,
            deltaOpenVsLedgerThb,
          })
        }
      }
    }
  } catch (e) {
    console.warn('[LedgerService.runReconciliationMvp] payoutSelfCheck skipped:', e?.message || e)
  }

  return {
    cashAccountLabel:
      'GUEST_PAYMENT_CLEARING — сверка только по журналам захвата оплаты (Booking Capture)',
    guestClearingDebitsThb: round2(guestClearingDebitsThb),
    distributionCreditsThb: round2(distributionCreditsThb),
    deltaThb,
    unbalancedJournals,
    marginLeakage,
    distributionScope: 'booking_capture_only_excludes_partner_payouts_settled',
    ...(payoutSelfCheck ? { payoutSelfCheck } : {}),
  }
}
