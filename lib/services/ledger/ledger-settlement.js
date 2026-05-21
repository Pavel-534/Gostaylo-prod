/**
 * Stage 110.3 — partner payout settlement journals (single payout + treasury batch).
 * Prod path: PayoutBatchService.markBatchSettled → postPartnerBatchBookingPayoutSettled.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { ensurePartnerLedgerAccount } from '@/lib/services/ledger/ledger-accounts.js'
import { LEDGER_ACC, round2 } from '@/lib/services/ledger/ledger-shared.js'

/**
 * Final posting when a payout is marked PAID: reduce PARTNER_EARNINGS vs settlement bucket.
 * Idempotent per payout id.
 * @param {{ id: string, partner_id?: string, partnerId?: string, gross_amount?: number|string, grossAmount?: number|string, amount?: number|string }} payout
 */
export async function postPartnerPayoutObligationSettled(payout) {
  const payoutId = payout?.id
  const partnerId = payout?.partner_id ?? payout?.partnerId
  if (!payoutId || !partnerId) {
    return { success: false, error: 'missing_payout_or_partner' }
  }

  const gross =
    parseFloat(payout?.gross_amount ?? payout?.grossAmount) || parseFloat(payout?.amount) || 0
  const amountThb = round2(gross)
  if (amountThb <= 0) {
    return { success: false, error: 'non_positive_amount_thb', amountThb }
  }

  const idempotencyKey = `payout_obligation_settled:${payoutId}`
  const { data: existing } = await supabaseAdmin
    .from('ledger_journals')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  if (existing?.id) {
    return { success: true, skipped: true, journalId: existing.id }
  }

  const partnerAccount = await ensurePartnerLedgerAccount(partnerId)
  if (!partnerAccount) {
    return { success: false, error: 'missing_partner_account' }
  }

  const journalId = `lj-payout-settled-${payoutId}`
  const now = new Date().toISOString()

  const { error: jErr } = await supabaseAdmin.from('ledger_journals').insert({
    id: journalId,
    booking_id: null,
    event_type: 'PARTNER_PAYOUT_OBLIGATION_SETTLED',
    idempotency_key: idempotencyKey,
    metadata: {
      payout_id: payoutId,
      partner_id: partnerId,
      amount_thb: amountThb,
      description: 'Partner liability settled (paid out)',
    },
    created_at: now,
  })
  if (jErr) {
    if (String(jErr.message || '').includes('duplicate') || jErr.code === '23505') {
      return { success: true, skipped: true }
    }
    if (
      String(jErr.message || '').includes('null value') &&
      String(jErr.message || '').includes('booking_id')
    ) {
      return {
        success: false,
        error:
          'ledger_journals.booking_id is still NOT NULL — apply migration database/migrations/032_ledger_payout_settlement.sql',
      }
    }
    console.error('[LedgerService] payout journal insert', jErr.message)
    return { success: false, error: jErr.message }
  }

  const lines = [
    {
      id: `le-${journalId}-dr-partner`,
      journal_id: journalId,
      account_id: partnerAccount,
      side: 'DEBIT',
      amount_thb: amountThb,
      description: 'Partner earnings — payout settled',
      metadata: { payout_id: payoutId, partner_id: partnerId },
    },
    {
      id: `le-${journalId}-cr-settled`,
      journal_id: journalId,
      account_id: LEDGER_ACC.partnerPayoutsSettled,
      side: 'CREDIT',
      amount_thb: amountThb,
      description: 'Partner payouts settled (bank / manual)',
      metadata: { payout_id: payoutId, partner_id: partnerId },
    },
  ]

  const { error: eErr } = await supabaseAdmin.from('ledger_entries').insert(lines)
  if (eErr) {
    console.error('[LedgerService] payout entries insert', eErr.message)
    await supabaseAdmin.from('ledger_journals').delete().eq('id', journalId)
    return { success: false, error: eErr.message }
  }

  return { success: true, journalId, amountThb }
}

/**
 * Treasury batch settled: one booking line → reduce partner liability (THB).
 * Idempotent: `payout_batch_settled:{batchId}:{bookingId}`.
 */
export async function postPartnerBatchBookingPayoutSettled({ batchId, bookingId, partnerId, amountThb }) {
  const bid = String(bookingId || '')
  const batch = String(batchId || '')
  const pid = String(partnerId || '')
  const amt = round2(amountThb)
  if (!bid || !batch || !pid || !(amt > 0)) {
    return { success: false, error: 'invalid_batch_settle_args' }
  }

  const idempotencyKey = `payout_batch_settled:${batch}:${bid}`
  const { data: existing } = await supabaseAdmin
    .from('ledger_journals')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  if (existing?.id) {
    return { success: true, skipped: true, journalId: existing.id }
  }

  const partnerAccount = await ensurePartnerLedgerAccount(pid)
  if (!partnerAccount) {
    return { success: false, error: 'missing_partner_account' }
  }

  const journalId = `lj-batch-settled-${batch}-${bid}`.slice(0, 120)
  const now = new Date().toISOString()

  const { error: jErr } = await supabaseAdmin.from('ledger_journals').insert({
    id: journalId,
    booking_id: bid,
    event_type: 'PARTNER_PAYOUT_OBLIGATION_SETTLED',
    idempotency_key: idempotencyKey,
    metadata: {
      payout_batch_id: batch,
      booking_id: bid,
      partner_id: pid,
      amount_thb: amt,
      description: 'Partner liability settled (treasury batch)',
    },
    created_at: now,
  })
  if (jErr) {
    if (String(jErr.message || '').includes('duplicate') || jErr.code === '23505') {
      return { success: true, skipped: true }
    }
    return { success: false, error: jErr.message }
  }

  const lines = [
    {
      id: `le-${journalId}-dr-partner`,
      journal_id: journalId,
      account_id: partnerAccount,
      side: 'DEBIT',
      amount_thb: amt,
      description: 'Partner earnings — batch payout settled',
      metadata: { payout_batch_id: batch, booking_id: bid, partner_id: pid },
    },
    {
      id: `le-${journalId}-cr-settled`,
      journal_id: journalId,
      account_id: LEDGER_ACC.partnerPayoutsSettled,
      side: 'CREDIT',
      amount_thb: amt,
      description: 'Partner payouts settled (treasury batch)',
      metadata: { payout_batch_id: batch, booking_id: bid, partner_id: pid },
    },
  ]

  const { error: eErr } = await supabaseAdmin.from('ledger_entries').insert(lines)
  if (eErr) {
    await supabaseAdmin.from('ledger_journals').delete().eq('id', journalId)
    return { success: false, error: eErr.message }
  }

  return { success: true, journalId, amountThb: amt }
}
