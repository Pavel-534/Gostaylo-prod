/**
 * Ledger: partner funds hold/release during official disputes (Stage 99).
 * @see lib/partner/partner-payout-eligibility.js
 */

import { supabaseAdmin } from '@/lib/supabase'

const ACC_DISPUTE_HOLD = 'la-sys-dispute-hold'

function round2(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(x * 100) / 100
}

function partnerAccountId(partnerId) {
  return `la-partner-${partnerId}`
}

/**
 * @param {{ bookingId: string, partnerId: string, amountThb: number, disputeId: string }} args
 */
export async function postDisputePartnerFundsHold(args) {
  const bookingId = String(args.bookingId || '')
  const partnerId = String(args.partnerId || '')
  const disputeId = String(args.disputeId || '')
  const amountThb = round2(args.amountThb)
  if (!bookingId || !partnerId || !disputeId || amountThb <= 0) {
    return { success: false, error: 'invalid_input' }
  }
  if (!supabaseAdmin) return { success: false, error: 'no_db' }

  const idempotencyKey = `dispute_hold:${disputeId}`
  const { data: existing } = await supabaseAdmin
    .from('ledger_journals')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  if (existing?.id) return { success: true, skipped: true, journalId: existing.id }

  const journalId = `lj-dsp-hold-${disputeId}`
  const now = new Date().toISOString()
  const partnerAcc = partnerAccountId(partnerId)

  const { error: jErr } = await supabaseAdmin.from('ledger_journals').insert({
    id: journalId,
    booking_id: bookingId,
    event_type: 'DISPUTE_PARTNER_FUNDS_HELD',
    idempotency_key: idempotencyKey,
    metadata: { dispute_id: disputeId, partner_id: partnerId, amount_thb: amountThb },
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
      account_id: partnerAcc,
      side: 'DEBIT',
      amount_thb: amountThb,
      description: 'Dispute hold — partner payout blocked',
      metadata: { booking_id: bookingId, dispute_id: disputeId },
    },
    {
      id: `le-${journalId}-cr-hold`,
      journal_id: journalId,
      account_id: ACC_DISPUTE_HOLD,
      side: 'CREDIT',
      amount_thb: amountThb,
      description: 'Dispute hold — system escrow',
      metadata: { booking_id: bookingId, dispute_id: disputeId },
    },
  ]

  const { error: eErr } = await supabaseAdmin.from('ledger_entries').insert(lines)
  if (eErr) {
    await supabaseAdmin.from('ledger_journals').delete().eq('id', journalId)
    return { success: false, error: eErr.message }
  }
  return { success: true, journalId }
}

/**
 * @param {{ bookingId: string, partnerId: string, amountThb: number, disputeId: string, resolutionReason?: string }} args
 */
export async function postDisputePartnerFundsRelease(args) {
  const bookingId = String(args.bookingId || '')
  const partnerId = String(args.partnerId || '')
  const disputeId = String(args.disputeId || '')
  const amountThb = round2(args.amountThb)
  if (!bookingId || !partnerId || !disputeId || amountThb <= 0) {
    return { success: false, error: 'invalid_input' }
  }
  if (!supabaseAdmin) return { success: false, error: 'no_db' }

  const idempotencyKey = `dispute_release:${disputeId}`
  const { data: existing } = await supabaseAdmin
    .from('ledger_journals')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  if (existing?.id) return { success: true, skipped: true, journalId: existing.id }

  const holdKey = `dispute_hold:${disputeId}`
  const { data: holdJournal } = await supabaseAdmin
    .from('ledger_journals')
    .select('id')
    .eq('idempotency_key', holdKey)
    .maybeSingle()
  if (!holdJournal?.id) {
    return { success: true, skipped: true, reason: 'no_prior_hold' }
  }

  const journalId = `lj-dsp-rel-${disputeId}`
  const now = new Date().toISOString()
  const partnerAcc = partnerAccountId(partnerId)
  const resolutionReason = String(args.resolutionReason || '').slice(0, 500)

  const { error: jErr } = await supabaseAdmin.from('ledger_journals').insert({
    id: journalId,
    booking_id: bookingId,
    event_type: 'DISPUTE_PARTNER_FUNDS_RELEASED',
    idempotency_key: idempotencyKey,
    metadata: {
      dispute_id: disputeId,
      partner_id: partnerId,
      amount_thb: amountThb,
      resolution_reason: resolutionReason || null,
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
      id: `le-${journalId}-dr-hold`,
      journal_id: journalId,
      account_id: ACC_DISPUTE_HOLD,
      side: 'DEBIT',
      amount_thb: amountThb,
      description: 'Dispute resolved — release hold',
      metadata: { booking_id: bookingId, dispute_id: disputeId },
    },
    {
      id: `le-${journalId}-cr-partner`,
      journal_id: journalId,
      account_id: partnerAcc,
      side: 'CREDIT',
      amount_thb: amountThb,
      description: 'Dispute resolved — partner funds released',
      metadata: { booking_id: bookingId, dispute_id: disputeId },
    },
  ]

  const { error: eErr } = await supabaseAdmin.from('ledger_entries').insert(lines)
  if (eErr) {
    await supabaseAdmin.from('ledger_journals').delete().eq('id', journalId)
    return { success: false, error: eErr.message }
  }
  return { success: true, journalId }
}

/**
 * Split: release partner share from hold + offset guest refund partner-debit from hold remainder.
 * Idempotent per dispute: `dispute_split_hold:{disputeId}`.
 */
export async function settleDisputeHoldForSplit(args) {
  const bookingId = String(args.bookingId || '')
  const partnerId = String(args.partnerId || '')
  const disputeId = String(args.disputeId || '')
  const partnerReleaseThb = round2(args.partnerReleaseThb)
  const holdGuestOffsetThb = round2(args.holdGuestOffsetThb)
  if (!bookingId || !partnerId || !disputeId) {
    return { success: false, error: 'invalid_input' }
  }
  if (!(partnerReleaseThb > 0) && !(holdGuestOffsetThb > 0)) {
    return { success: true, skipped: true, reason: 'zero_hold_split' }
  }
  if (!supabaseAdmin) return { success: false, error: 'no_db' }

  const holdKey = `dispute_hold:${disputeId}`
  const { data: holdJournal } = await supabaseAdmin
    .from('ledger_journals')
    .select('id')
    .eq('idempotency_key', holdKey)
    .maybeSingle()
  if (!holdJournal?.id) {
    return { success: true, skipped: true, reason: 'no_prior_hold' }
  }

  const idempotencyKey = `dispute_split_hold:${disputeId}`
  const { data: existing } = await supabaseAdmin
    .from('ledger_journals')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  if (existing?.id) return { success: true, skipped: true, journalId: existing.id }

  const journalId = `lj-dsp-split-${disputeId}`.slice(0, 120)
  const now = new Date().toISOString()
  const partnerAcc = partnerAccountId(partnerId)
  const resolutionReason = String(args.resolutionReason || '').slice(0, 500)
  const guestPercent = Number.isFinite(Number(args.guestPercent)) ? Number(args.guestPercent) : null

  const { error: jErr } = await supabaseAdmin.from('ledger_journals').insert({
    id: journalId,
    booking_id: bookingId,
    event_type: 'DISPUTE_SPLIT_HOLD_SETTLED',
    idempotency_key: idempotencyKey,
    metadata: {
      dispute_id: disputeId,
      partner_id: partnerId,
      partner_release_thb: partnerReleaseThb,
      hold_guest_offset_thb: holdGuestOffsetThb,
      guest_percent: guestPercent,
      resolution_reason: resolutionReason || null,
    },
    created_at: now,
  })
  if (jErr) {
    if (String(jErr.message || '').includes('duplicate') || jErr.code === '23505') {
      return { success: true, skipped: true }
    }
    return { success: false, error: jErr.message }
  }

  const lines = []
  if (partnerReleaseThb > 0) {
    lines.push(
      {
        id: `le-${journalId}-dr-hold-partner`,
        journal_id: journalId,
        account_id: ACC_DISPUTE_HOLD,
        side: 'DEBIT',
        amount_thb: partnerReleaseThb,
        description: 'Dispute split — partner share from hold',
        metadata: { booking_id: bookingId, dispute_id: disputeId, leg: 'partner_release' },
      },
      {
        id: `le-${journalId}-cr-partner-release`,
        journal_id: journalId,
        account_id: partnerAcc,
        side: 'CREDIT',
        amount_thb: partnerReleaseThb,
        description: 'Dispute split — partner payout share',
        metadata: { booking_id: bookingId, dispute_id: disputeId, leg: 'partner_release' },
      },
    )
  }
  if (holdGuestOffsetThb > 0) {
    lines.push(
      {
        id: `le-${journalId}-dr-hold-guest`,
        journal_id: journalId,
        account_id: ACC_DISPUTE_HOLD,
        side: 'DEBIT',
        amount_thb: holdGuestOffsetThb,
        description: 'Dispute split — hold offset for guest refund',
        metadata: { booking_id: bookingId, dispute_id: disputeId, leg: 'guest_offset' },
      },
      {
        id: `le-${journalId}-cr-partner-offset`,
        journal_id: journalId,
        account_id: partnerAcc,
        side: 'CREDIT',
        amount_thb: holdGuestOffsetThb,
        description: 'Dispute split — partner offset for guest refund',
        metadata: { booking_id: bookingId, dispute_id: disputeId, leg: 'guest_offset' },
      },
    )
  }

  const { error: eErr } = await supabaseAdmin.from('ledger_entries').insert(lines)
  if (eErr) {
    await supabaseAdmin.from('ledger_journals').delete().eq('id', journalId)
    return { success: false, error: eErr.message }
  }
  return { success: true, journalId, partnerReleaseThb, holdGuestOffsetThb }
}

/**
 * Full guest refund: zero dispute hold without partner payout (offset pairs with refund DR).
 * Idempotent per dispute: `dispute_refund_hold:{disputeId}`.
 */
export async function settleDisputeHoldForRefund(args) {
  const bookingId = String(args.bookingId || '')
  const partnerId = String(args.partnerId || '')
  const disputeId = String(args.disputeId || '')
  const amountThb = round2(args.amountThb ?? args.partnerNetThb)
  if (!bookingId || !partnerId || !disputeId || !(amountThb > 0)) {
    return { success: false, error: 'invalid_input' }
  }
  if (!supabaseAdmin) return { success: false, error: 'no_db' }

  const holdKey = `dispute_hold:${disputeId}`
  const { data: holdJournal } = await supabaseAdmin
    .from('ledger_journals')
    .select('id, metadata')
    .eq('idempotency_key', holdKey)
    .maybeSingle()
  if (!holdJournal?.id) {
    return { success: true, skipped: true, reason: 'no_prior_hold' }
  }

  const settledKeys = [
    `dispute_release:${disputeId}`,
    `dispute_split_hold:${disputeId}`,
    `dispute_refund_hold:${disputeId}`,
  ]
  const { data: settledRows } = await supabaseAdmin
    .from('ledger_journals')
    .select('id')
    .in('idempotency_key', settledKeys)
  if ((settledRows || []).length > 0) {
    return { success: true, skipped: true, reason: 'hold_already_settled' }
  }

  const holdAmount = round2(holdJournal.metadata?.amount_thb ?? amountThb)
  const settleThb = holdAmount > 0 ? holdAmount : amountThb

  const idempotencyKey = `dispute_refund_hold:${disputeId}`
  const { data: existing } = await supabaseAdmin
    .from('ledger_journals')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  if (existing?.id) return { success: true, skipped: true, journalId: existing.id }

  const journalId = `lj-dsp-refund-${disputeId}`.slice(0, 120)
  const now = new Date().toISOString()
  const partnerAcc = partnerAccountId(partnerId)
  const resolutionReason = String(args.resolutionReason || '').slice(0, 500)

  const { error: jErr } = await supabaseAdmin.from('ledger_journals').insert({
    id: journalId,
    booking_id: bookingId,
    event_type: 'DISPUTE_REFUND_HOLD_SETTLED',
    idempotency_key: idempotencyKey,
    metadata: {
      dispute_id: disputeId,
      partner_id: partnerId,
      hold_settled_thb: settleThb,
      resolution_reason: resolutionReason || null,
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
      id: `le-${journalId}-dr-hold`,
      journal_id: journalId,
      account_id: ACC_DISPUTE_HOLD,
      side: 'DEBIT',
      amount_thb: settleThb,
      description: 'Dispute refund — release hold (guest favor)',
      metadata: { booking_id: bookingId, dispute_id: disputeId, leg: 'refund_hold' },
    },
    {
      id: `le-${journalId}-cr-partner-offset`,
      journal_id: journalId,
      account_id: partnerAcc,
      side: 'CREDIT',
      amount_thb: settleThb,
      description: 'Dispute refund — partner offset for guest refund',
      metadata: { booking_id: bookingId, dispute_id: disputeId, leg: 'refund_hold' },
    },
  ]

  const { error: eErr } = await supabaseAdmin.from('ledger_entries').insert(lines)
  if (eErr) {
    await supabaseAdmin.from('ledger_journals').delete().eq('id', journalId)
    return { success: false, error: eErr.message }
  }
  return { success: true, journalId, holdSettledThb: settleThb }
}
