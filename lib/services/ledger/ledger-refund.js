/**
 * Stage 110.3 — BOOKING_REFUND_PARTIAL journal (cancel with ledger unwind).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { computeBookingPaymentLedgerLegs } from '@/lib/services/ledger/ledger-capture-legs.js'
import { ensurePartnerLedgerAccount } from '@/lib/services/ledger/ledger-accounts.js'
import { LEDGER_ACC, round2 } from '@/lib/services/ledger/ledger-shared.js'

/**
 * Partial refund to guest — unwind capture split proportionally (THB).
 * Idempotent per booking: `booking_refund_partial:{bookingId}`.
 *
 * @param {object} booking
 * @param {{ refundGuestThb: number, reason?: string }} options
 */
export async function postPartialRefundForBooking(booking, options = {}) {
  const bookingId = booking?.id
  const refundGuestThb = round2(parseFloat(options.refundGuestThb))
  if (!bookingId || !(refundGuestThb > 0)) {
    return { success: false, error: 'invalid_refund_or_booking' }
  }

  const legs0 = computeBookingPaymentLedgerLegs(booking)
  const cap = round2(legs0.guestTotalThb)
  if (cap <= 0) {
    return { success: false, error: 'non_positive_capture' }
  }
  const r = Math.min(refundGuestThb, cap)

  const idempotencyKey = `booking_refund_partial:${bookingId}`
  const { data: existing } = await supabaseAdmin
    .from('ledger_journals')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  if (existing?.id) {
    return { success: true, skipped: true, journalId: existing.id }
  }

  const partnerId = booking.partner_id
  const partnerAccount = await ensurePartnerLedgerAccount(partnerId)
  if (!partnerAccount) {
    return { success: false, error: 'missing_partner' }
  }

  const ratio = r / cap
  let partnerDr = round2(legs0.partnerThb * ratio)
  let insDr = round2(legs0.insuranceThb * ratio)
  let potDr = round2(legs0.roundingThb * ratio)
  let platformDr = 0
  let ruDr = 0
  let kgDr = 0
  let fxDr = 0
  let hostDr = 0

  if (legs0.ledgerV2) {
    ruDr = round2((legs0.ruFeeThb || 0) * ratio)
    kgDr = round2((legs0.krFeeThb || 0) * ratio)
    fxDr = round2((legs0.fxMarkupThb || 0) * ratio)
    hostDr = round2((legs0.platformHostFeeThb || 0) * ratio)
  } else {
    platformDr = round2(legs0.platformFeeThb * ratio)
  }

  const sum = round2(partnerDr + insDr + potDr + platformDr + ruDr + kgDr + fxDr + hostDr)
  const drift = round2(r - sum)
  potDr = round2(potDr + drift)

  const journalId = `lj-refund-${bookingId}`.slice(0, 120)
  const now = new Date().toISOString()

  const { error: jErr } = await supabaseAdmin.from('ledger_journals').insert({
    id: journalId,
    booking_id: bookingId,
    event_type: 'BOOKING_REFUND_PARTIAL',
    idempotency_key: idempotencyKey,
    metadata: {
      refund_guest_thb: r,
      reason: options.reason || null,
      legs: { partnerDr, platformDr, ruDr, kgDr, fxDr, hostDr, insuranceDr: insDr, potDr },
    },
    created_at: now,
  })
  if (jErr) {
    if (String(jErr.message || '').includes('duplicate') || jErr.code === '23505') {
      return { success: true, skipped: true }
    }
    console.error('[LedgerService] refund journal insert', jErr.message)
    return { success: false, error: jErr.message }
  }

  const lines = [
    {
      id: `le-${journalId}-cr-guest`,
      journal_id: journalId,
      account_id: LEDGER_ACC.guestClearing,
      side: 'CREDIT',
      amount_thb: r,
      description: 'Partial refund to guest (clearing)',
      metadata: { booking_id: bookingId },
    },
    {
      id: `le-${journalId}-dr-partner`,
      journal_id: journalId,
      account_id: partnerAccount,
      side: 'DEBIT',
      amount_thb: partnerDr,
      description: 'Partial refund — partner share reversal',
      metadata: { booking_id: bookingId, partner_id: partnerId },
    },
    {
      id: `le-${journalId}-dr-ins`,
      journal_id: journalId,
      account_id: LEDGER_ACC.insurance,
      side: 'DEBIT',
      amount_thb: insDr,
      description: 'Partial refund — insurance reserve reversal',
      metadata: { booking_id: bookingId },
    },
  ]

  if (legs0.ledgerV2) {
    if (ruDr > 0) {
      lines.push({
        id: `le-${journalId}-dr-platform-ru`,
        journal_id: journalId,
        account_id: LEDGER_ACC.platformFeeRu,
        side: 'DEBIT',
        amount_thb: ruDr,
        description: 'Partial refund — RU agency fee reversal',
        metadata: { booking_id: bookingId },
      })
    }
    if (kgDr > 0) {
      lines.push({
        id: `le-${journalId}-dr-platform-kg`,
        journal_id: journalId,
        account_id: LEDGER_ACC.platformFeeKg,
        side: 'DEBIT',
        amount_thb: kgDr,
        description: 'Partial refund — KG IT/service fee reversal',
        metadata: { booking_id: bookingId },
      })
    }
    if (fxDr > 0) {
      lines.push({
        id: `le-${journalId}-dr-fx-kg`,
        journal_id: journalId,
        account_id: LEDGER_ACC.fxMarkupKg,
        side: 'DEBIT',
        amount_thb: fxDr,
        description: 'Partial refund — FX markup reversal',
        metadata: { booking_id: bookingId },
      })
    }
    if (hostDr > 0) {
      lines.push({
        id: `le-${journalId}-dr-platform-host`,
        journal_id: journalId,
        account_id: LEDGER_ACC.platformFee,
        side: 'DEBIT',
        amount_thb: hostDr,
        description: 'Partial refund — host commission reversal',
        metadata: { booking_id: bookingId },
      })
    }
  } else if (platformDr > 0) {
    lines.push({
      id: `le-${journalId}-dr-platform`,
      journal_id: journalId,
      account_id: LEDGER_ACC.platformFee,
      side: 'DEBIT',
      amount_thb: platformDr,
      description: 'Partial refund — platform share reversal',
      metadata: { booking_id: bookingId },
    })
  }

  if (potDr > 0) {
    lines.push({
      id: `le-${journalId}-dr-pot`,
      journal_id: journalId,
      account_id: LEDGER_ACC.processingPot,
      side: 'DEBIT',
      amount_thb: potDr,
      description: 'Partial refund — rounding pot reversal',
      metadata: { booking_id: bookingId },
    })
  }

  const { error: eErr } = await supabaseAdmin.from('ledger_entries').insert(lines)
  if (eErr) {
    console.error('[LedgerService] refund entries insert', eErr.message)
    await supabaseAdmin.from('ledger_journals').delete().eq('id', journalId)
    return { success: false, error: eErr.message }
  }

  return { success: true, journalId, refundGuestThb: r }
}
