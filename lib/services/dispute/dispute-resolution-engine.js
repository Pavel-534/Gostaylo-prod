/**
 * Stage 141.1 — SSOT dispute arbitration strategies (financial + booking outcome).
 *
 * Strategies:
 * - PAYOUT_PARTNER — release dispute hold → partner
 * - REFUND_GUEST — ledger partial/full refund → booking REFUNDED
 * - SPLIT — partial guest refund + settle hold (remainder → partner)
 * - DISMISS — close without refund; release hold if present
 */

import { supabaseAdmin } from '@/lib/supabase'
import { LedgerService, computeBookingPaymentLedgerLegs } from '@/lib/services/ledger.service.js'
import { transitionBookingStatus } from '@/lib/services/booking/booking-status.service.js'
import { recordCriticalSignal } from '@/lib/critical-telemetry.js'
import {
  clearDisputePayoutMetadata,
  releaseDisputePayoutFreeze,
} from '@/lib/services/dispute/dispute-payout-freeze.js'
import {
  postDisputePartnerFundsRelease,
  settleDisputeHoldForSplit,
  settleDisputeHoldForRefund,
} from '@/lib/services/ledger/ledger-dispute.js'
import EscrowService from '@/lib/services/escrow.service.js'
import { extractSettlementSnapshot } from '@/lib/services/escrow/utils.js'
import { assertWalletBucketIntegrity } from '@/lib/smoke/wallet-bucket-assert.js'

export const DisputeResolutionStrategy = Object.freeze({
  PAYOUT_PARTNER: 'PAYOUT_PARTNER',
  REFUND_GUEST: 'REFUND_GUEST',
  SPLIT: 'SPLIT',
  DISMISS: 'DISMISS',
})

function resolveTargetDisputeTerminalStatus({ trigger }) {
  const t = String(trigger || '').toLowerCase()
  if (t.includes('close_dispute')) return 'CLOSED'
  return 'RESOLVED'
}

async function setDisputeResolutionLedgerStatus({
  disputeId,
  status,
  actorId,
  actorRole,
  trigger,
  resolutionReason,
  targetStatus,
  doneAtIso,
  sagaReplay,
  extra = {},
}) {
  const id = String(disputeId || '').trim()
  if (!id || !supabaseAdmin) return

  try {
    const { data: row } = await supabaseAdmin
      .from('disputes')
      .select('metadata')
      .eq('id', id)
      .maybeSingle()

    const baseMeta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {}
    const nowIso = new Date().toISOString()

    const nextMeta = {
      ...baseMeta,
      resolution_ledger_status: String(status || '').toUpperCase(),
      ...(targetStatus ? { resolution_ledger_target_status: String(targetStatus).toUpperCase() } : {}),
      ...(trigger ? { resolution_ledger_trigger: String(trigger).slice(0, 80) } : {}),
      ...(resolutionReason ? { resolution_ledger_reason: String(resolutionReason).slice(0, 2000) } : {}),
      ...(actorId ? { resolution_ledger_actor_id: String(actorId) } : {}),
      ...(actorRole ? { resolution_ledger_actor_role: String(actorRole).slice(0, 64) } : {}),
      ...(doneAtIso ? { resolution_ledger_done_at: doneAtIso } : {}),
      ...(sagaReplay && typeof sagaReplay === 'object' ? { resolution_saga_replay: sagaReplay } : {}),
      ...extra,
    }

    const { error: upErr } = await supabaseAdmin
      .from('disputes')
      .update({ metadata: nextMeta, updated_at: nowIso })
      .eq('id', id)

    if (upErr) {
      console.warn('[dispute-resolution-engine] resolution_ledger_status update failed:', upErr.message)
    }
  } catch (e) {
    console.warn('[dispute-resolution-engine] resolution_ledger_status write threw:', e?.message || e)
  }
}

async function maybeAssertWalletBucketIntegritySoft(partnerId, { label, context = {} } = {}) {
  const pid = String(partnerId || '').trim()
  if (!pid) return

  try {
    await assertWalletBucketIntegrity(pid, { label })
  } catch (e) {
    const msg = e?.message || String(e)
    const isDrift =
      String(msg).toLowerCase().includes('wallet bucket drift') || String(msg).toLowerCase().includes('drift')
    if (!isDrift) {
      console.warn('[dispute-resolution-engine] wallet bucket assert error:', msg)
      return
    }
    recordCriticalSignal('POST_DISPUTE_BUCKET_DRIFT', {
      threshold: 1,
      windowMs: 60 * 60 * 1000,
      tag: '[FINTECH_BUCKET_ASSERT]',
      detailLines: [msg, JSON.stringify({ partnerId: pid, label: label || null, context }, null, 0)].slice(0, 12),
    })
  }
}

function round2(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(x * 100) / 100
}

function partnerNetThb(booking) {
  const settlement = extractSettlementSnapshot(booking)
  const price = parseFloat(booking?.price_thb) || 0
  const comm = parseFloat(booking?.commission_thb) || 0
  const net = Number.isFinite(parseFloat(settlement?.partner_net?.thb))
    ? parseFloat(settlement.partner_net.thb)
    : parseFloat(booking?.partner_earnings_thb) || price - comm
  return round2(net)
}

/**
 * Preview split amounts for admin UI (same math as execute).
 * @param {object} booking
 * @param {number} guestPercent 0–100
 */
export function computeSplitAmounts(booking, guestPercent) {
  const pct = Math.min(100, Math.max(0, Number(guestPercent) || 0))
  const legs = computeBookingPaymentLedgerLegs(booking)
  const guestTotalThb = round2(legs.guestTotalThb)
  const partnerNet = partnerNetThb(booking)
  const refundGuestThb = round2((guestTotalThb * pct) / 100)
  const partnerReleaseThb = round2((partnerNet * (100 - pct)) / 100)
  const holdGuestOffsetThb = round2(partnerNet - partnerReleaseThb)
  return {
    guestPercent: pct,
    guestTotalThb,
    partnerNetThb: partnerNet,
    refundGuestThb,
    partnerReleaseThb,
    holdGuestOffsetThb,
  }
}

function normalizeGuestPercent(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  if (n <= 0 || n >= 100) return null
  return round2(n)
}

async function loadBooking(bookingId) {
  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .maybeSingle()
  if (error || !booking) return { booking: null, error: error?.message || 'booking_not_found' }
  return { booking, error: null }
}

async function syncPartner(partnerId) {
  if (!partnerId) return
  try {
    await EscrowService.syncPartnerBalanceColumns(String(partnerId))
  } catch (e) {
    console.warn('[DisputeResolutionEngine] syncPartnerBalanceColumns', partnerId, e?.message || e)
  }
}

async function runReferralHook({ bookingId, disputeId, trigger, resolutionReason }) {
  try {
    const { onDisputeResolved } = await import('@/lib/services/marketing/referral-lifecycle-hook.js')
    await onDisputeResolved({ bookingId, disputeId, trigger, resolutionReason })
  } catch (e) {
    console.warn('[DisputeResolutionEngine] referral hook', bookingId, e?.message || e)
  }
}

/**
 * @param {{
 *   strategy: string,
 *   bookingId: string,
 *   disputeId?: string,
 *   resolutionReason?: string,
 *   actorId?: string,
 *   actorRole?: string,
 *   trigger?: string,
 *   guestPercent?: number,
 *   refundGuestThb?: number,
 * }} args
 */
export async function executeDisputeResolution(args) {
  const bookingId = String(args.bookingId || '').trim()
  const disputeId = String(args.disputeId || '').trim()
  const strategy = String(args.strategy || '').toUpperCase()
  const resolutionReason = String(args.resolutionReason || '').slice(0, 2000)
  const trigger = args.trigger || `dispute_resolution_${strategy.toLowerCase()}`

  if (!bookingId || !supabaseAdmin) {
    return { success: false, error: 'invalid_input', strategy }
  }
  if (!Object.values(DisputeResolutionStrategy).includes(strategy)) {
    return { success: false, error: 'unknown_strategy', strategy }
  }

  const { booking, error: loadErr } = await loadBooking(bookingId)
  if (loadErr || !booking) {
    return { success: false, error: loadErr || 'booking_not_found', strategy }
  }

  const partnerId = String(booking.partner_id || '')
  const legs = computeBookingPaymentLedgerLegs(booking)
  const partnerNet = partnerNetThb(booking)
  const ledgerResults = {}

  const actorId = args.actorId || null
  const actorRole = args.actorRole || null
  const targetStatus = resolveTargetDisputeTerminalStatus({ trigger })

  function buildSagaReplay(result = {}) {
    return {
      strategy,
      targetStatus,
      trigger,
      resolutionReason,
      actorId,
      actorRole,
      guestPercent: result.guestPercent ?? args.guestPercent ?? null,
      refundGuestThb: result.refundGuestThb ?? null,
      partnerReleaseThb: result.partnerReleaseThb ?? null,
    }
  }

  async function markLedgerDone(result = {}) {
    await setDisputeResolutionLedgerStatus({
      disputeId: disputeId || null,
      status: 'DONE',
      actorId,
      actorRole,
      trigger,
      resolutionReason,
      targetStatus,
      doneAtIso: new Date().toISOString(),
      sagaReplay: buildSagaReplay(result),
    })
  }
  await setDisputeResolutionLedgerStatus({
    disputeId: disputeId || null,
    status: 'PENDING',
    actorId,
    actorRole,
    trigger,
    resolutionReason,
    targetStatus,
  })

  if (strategy === DisputeResolutionStrategy.REFUND_GUEST) {
    const refundGuestThb =
      Number.isFinite(Number(args.refundGuestThb)) && Number(args.refundGuestThb) > 0
        ? round2(args.refundGuestThb)
        : round2(legs.guestTotalThb)

    if (refundGuestThb > 0) {
      ledgerResults.refund = await LedgerService.postPartialRefundForBooking(booking, {
        refundGuestThb,
        reason: resolutionReason || 'dispute_guest_refund',
      })
      if (!ledgerResults.refund.success) {
        return {
          success: false,
          error: ledgerResults.refund.error || 'ledger_refund_failed',
          strategy,
          ledgerResults,
        }
      }
    }

    if (disputeId && partnerId && partnerNet > 0) {
      ledgerResults.holdRefund = await settleDisputeHoldForRefund({
        bookingId,
        disputeId,
        partnerId,
        partnerNetThb: partnerNet,
        resolutionReason,
      })
      if (!ledgerResults.holdRefund.success) {
        return {
          success: false,
          error: ledgerResults.holdRefund.error || 'hold_refund_settle_failed',
          strategy,
          ledgerResults,
        }
      }
    }

    await markLedgerDone({ refundGuestThb })

    await clearDisputePayoutMetadata({ bookingId, disputeId, resolutionReason })

    const now = new Date().toISOString()
    const statusRes = await transitionBookingStatus(bookingId, 'REFUNDED', {
      scope: 'system',
      actorContext: {
        actorId: args.actorId || null,
        actorRole: args.actorRole || (args.actorId ? 'ADMIN' : 'SYSTEM'),
        trigger,
      },
      metadata: { updatedAt: now },
    })
    if (!statusRes.success) {
      return {
        success: false,
        error: statusRes.error || 'BOOKING_REFUND_TRANSITION_FAILED',
        strategy,
        ledgerResults,
      }
    }

    await syncPartner(partnerId)
    await maybeAssertWalletBucketIntegritySoft(partnerId, {
      label: 'post-dispute',
      context: { strategy, trigger, bookingId, disputeId },
    })
    return {
      success: true,
      strategy,
      refundGuestThb,
      partnerReleaseThb: 0,
      bookingStatus: 'REFUNDED',
      ledgerResults,
      statusRes,
    }
  }

  if (strategy === DisputeResolutionStrategy.PAYOUT_PARTNER) {
    if (disputeId) {
      ledgerResults.release = await releaseDisputePayoutFreeze({
        bookingId,
        disputeId,
        resolutionReason,
      })
    } else {
      await clearDisputePayoutMetadata({ bookingId, disputeId, resolutionReason })
    }

    await markLedgerDone({ partnerReleaseThb: partnerNet })

    await runReferralHook({ bookingId, disputeId, trigger, resolutionReason })
    await syncPartner(partnerId)
    await maybeAssertWalletBucketIntegritySoft(partnerId, {
      label: 'post-dispute',
      context: { strategy, trigger, bookingId, disputeId },
    })
    return {
      success: true,
      strategy,
      refundGuestThb: 0,
      partnerReleaseThb: partnerNet,
      bookingStatus: String(booking.status || ''),
      ledgerResults,
    }
  }

  if (strategy === DisputeResolutionStrategy.DISMISS) {
    if (disputeId) {
      ledgerResults.release = await releaseDisputePayoutFreeze({
        bookingId,
        disputeId,
        resolutionReason: resolutionReason || 'dispute_dismissed',
      })
    } else {
      await clearDisputePayoutMetadata({ bookingId, disputeId, resolutionReason })
    }

    await markLedgerDone({ partnerReleaseThb: partnerNet })

    await runReferralHook({ bookingId, disputeId, trigger, resolutionReason })
    await syncPartner(partnerId)
    await maybeAssertWalletBucketIntegritySoft(partnerId, {
      label: 'post-dispute',
      context: { strategy, trigger, bookingId, disputeId },
    })
    return {
      success: true,
      strategy,
      refundGuestThb: 0,
      partnerReleaseThb: partnerNet,
      bookingStatus: String(booking.status || ''),
      ledgerResults,
    }
  }

  if (strategy === DisputeResolutionStrategy.SPLIT) {
    const guestPercent = normalizeGuestPercent(args.guestPercent)
    if (guestPercent == null) {
      return { success: false, error: 'invalid_guest_percent', strategy }
    }

    const split = computeSplitAmounts(booking, guestPercent)
    const { refundGuestThb, partnerReleaseThb, holdGuestOffsetThb } = split

    if (refundGuestThb > 0) {
      ledgerResults.refund = await LedgerService.postPartialRefundForBooking(booking, {
        refundGuestThb,
        reason: resolutionReason || `dispute_split_guest_${guestPercent}pct`,
      })
      if (!ledgerResults.refund.success) {
        return {
          success: false,
          error: ledgerResults.refund.error || 'ledger_refund_failed',
          strategy,
          ledgerResults,
          split,
        }
      }
    }

    if (disputeId && partnerId && partnerNet > 0) {
      ledgerResults.holdSplit = await settleDisputeHoldForSplit({
        bookingId,
        disputeId,
        partnerId,
        partnerNetThb: partnerNet,
        partnerReleaseThb,
        holdGuestOffsetThb,
        guestPercent,
        resolutionReason,
      })
      if (!ledgerResults.holdSplit.success) {
        return {
          success: false,
          error: ledgerResults.holdSplit.error || 'hold_split_failed',
          strategy,
          ledgerResults,
          split,
        }
      }
    } else if (partnerReleaseThb > 0 && disputeId && partnerId) {
      ledgerResults.release = await postDisputePartnerFundsRelease({
        bookingId,
        partnerId,
        amountThb: partnerReleaseThb,
        disputeId,
        resolutionReason,
      })
    }

    await markLedgerDone({ guestPercent, refundGuestThb, partnerReleaseThb })

    await clearDisputePayoutMetadata({ bookingId, disputeId, resolutionReason })
    await runReferralHook({ bookingId, disputeId, trigger, resolutionReason })
    await syncPartner(partnerId)
    await maybeAssertWalletBucketIntegritySoft(partnerId, {
      label: 'post-dispute',
      context: { strategy, trigger, bookingId, disputeId },
    })

    return {
      success: true,
      strategy,
      guestPercent,
      refundGuestThb,
      partnerReleaseThb,
      holdGuestOffsetThb,
      bookingStatus: String(booking.status || ''),
      ledgerResults,
      split,
    }
  }

  return { success: false, error: 'unhandled_strategy', strategy }
}

/** @deprecated Use executeDisputeResolution({ strategy: REFUND_GUEST }) */
export async function resolveDisputeInFavorOfGuest(args) {
  const result = await executeDisputeResolution({
    strategy: DisputeResolutionStrategy.REFUND_GUEST,
    bookingId: args.bookingId,
    disputeId: args.disputeId,
    resolutionReason: args.resolutionReason,
    refundGuestThb: args.refundGuestThb,
    actorId: args.actorId,
    actorRole: args.actorId ? 'ADMIN' : 'SYSTEM',
    trigger: args.trigger || 'dispute_guest_refund',
  })
  if (!result.success) return result
  return {
    success: true,
    ledgerResult: result.ledgerResults?.refund,
    statusRes: result.statusRes,
    refundGuestThb: result.refundGuestThb,
  }
}

export class DisputeResolutionEngine {
  static Strategy = DisputeResolutionStrategy
  static execute = executeDisputeResolution
  static computeSplitAmounts = computeSplitAmounts
  static resolveDisputeInFavorOfGuest = resolveDisputeInFavorOfGuest
}

export default DisputeResolutionEngine
