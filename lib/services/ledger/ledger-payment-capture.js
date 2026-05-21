/**
 * Stage 110.3 — BOOKING_PAYMENT_CAPTURED journal (trigger: EscrowService.moveToEscrow → PAID_ESCROW).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { isFintechTestBookingRow } from '@/lib/admin/fintech-test-data-markers.js'
import { withFintechTestDataMeta } from '@/lib/admin/fintech-test-data-meta.js'
import { notifyLedgerGuestPaymentClearingPosted } from '@/lib/services/ledger-telegram-notify'
import {
  computeBookingPaymentLedgerLegs,
  scaleLedgerLegsToGuestTotal,
} from '@/lib/services/ledger/ledger-capture-legs.js'
import { ensurePartnerLedgerAccount } from '@/lib/services/ledger/ledger-accounts.js'
import {
  LEDGER_ACC,
  round2,
  buildRubPostingFields,
  buildCaptureCreditLines,
} from '@/lib/services/ledger/ledger-shared.js'
import { sumNetBalancesByAccountIds } from '@/lib/services/ledger/ledger-balance.js'

/**
 * Post payment-capture journal (idempotent per booking).
 * @param {object} booking — full booking row after escrow update
 */
export async function postPaymentCaptureFromBooking(booking) {
  const bookingId = booking?.id
  if (!bookingId) return { success: false, error: 'missing_booking_id' }

  const idempotencyKey = `booking_payment_capture:${bookingId}`
  const { data: existing } = await supabaseAdmin
    .from('ledger_journals')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  if (existing?.id) {
    return { success: true, skipped: true, journalId: existing.id }
  }

  const legs0 = computeBookingPaymentLedgerLegs(booking)
  const capRaw = booking?.metadata?.payment_verification?.captureGuestTotalThb
  const cap = Number(capRaw)
  const legs =
    Number.isFinite(cap) && cap > 0 && Math.abs(cap - legs0.guestTotalThb) > 0.02
      ? scaleLedgerLegsToGuestTotal(legs0, cap)
      : legs0
  if (legs.guestTotalThb <= 0) {
    return { success: false, error: 'non_positive_guest_total', legs }
  }

  const partnerId = booking.partner_id
  const partnerAccount = await ensurePartnerLedgerAccount(partnerId)
  if (!partnerAccount) {
    return { success: false, error: 'missing_partner_id' }
  }

  const journalId = `lj-cap-${bookingId}`
  const now = new Date().toISOString()

  const { error: jErr } = await supabaseAdmin.from('ledger_journals').insert({
    id: journalId,
    booking_id: bookingId,
    event_type: 'BOOKING_PAYMENT_CAPTURED',
    idempotency_key: idempotencyKey,
    metadata: isFintechTestBookingRow(booking)
      ? withFintechTestDataMeta({ legs, status_at_post: booking.status })
      : { legs, status_at_post: booking.status },
    created_at: now,
  })
  if (jErr) {
    if (String(jErr.message || '').includes('duplicate') || jErr.code === '23505') {
      return { success: true, skipped: true }
    }
    console.error('[LedgerService] journal insert', jErr.message)
    return { success: false, error: jErr.message }
  }

  const rubFields = await buildRubPostingFields(booking, legs)
  const lineMetaBase = isFintechTestBookingRow(booking)
    ? withFintechTestDataMeta({ booking_id: bookingId, ledger_v2: Boolean(legs.ledgerV2) })
    : { booking_id: bookingId, ledger_v2: Boolean(legs.ledgerV2) }

  const lines = [
    {
      id: `le-${journalId}-dr-guest`,
      journal_id: journalId,
      account_id: LEDGER_ACC.guestClearing,
      side: 'DEBIT',
      amount_thb: legs.guestTotalThb,
      description: 'Guest funds received (clearing)',
      metadata: lineMetaBase,
      amount_total_rub: rubFields.amount_total_rub ?? null,
      host_payout_base_currency: rubFields.host_payout_base_currency ?? null,
    },
    ...buildCaptureCreditLines(journalId, bookingId, legs, partnerAccount, partnerId, rubFields),
  ]

  const { error: eErr } = await supabaseAdmin.from('ledger_entries').insert(lines)
  if (eErr) {
    console.error('[LedgerService] entries insert', eErr.message)
    await supabaseAdmin.from('ledger_journals').delete().eq('id', journalId)
    return { success: false, error: eErr.message }
  }

  const guestLine = lines.find((l) => l.account_id === LEDGER_ACC.guestClearing && l.side === 'DEBIT')
  if (guestLine) {
    let feeClearingPotThb = null
    try {
      const potBal = await sumNetBalancesByAccountIds([LEDGER_ACC.processingPot])
      feeClearingPotThb = round2(potBal[LEDGER_ACC.processingPot] ?? 0)
    } catch (e) {
      console.warn('[LedgerService] pot balance for telegram:', e?.message || e)
    }
    notifyLedgerGuestPaymentClearingPosted({
      bookingId,
      guestTotalThb: legs.guestTotalThb,
      journalId,
      feeClearingPotThb,
    })
  }

  return { success: true, journalId, legs }
}
