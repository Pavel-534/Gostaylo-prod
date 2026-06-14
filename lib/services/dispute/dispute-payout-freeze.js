/**
 * Booking metadata + ledger when official dispute freezes partner payout (Stage 99).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { BookingStatus } from '@/lib/services/escrow/constants.js'
import { extractSettlementSnapshot } from '@/lib/services/escrow/utils.js'
import {
  postDisputePartnerFundsHold,
  postDisputePartnerFundsRelease,
} from '@/lib/services/ledger/ledger-dispute.js'
import EscrowService from '@/lib/services/escrow.service.js'

const PAYOUT_STATUSES = new Set([
  BookingStatus.PAID_ESCROW,
  BookingStatus.THAWED,
  BookingStatus.READY_FOR_PAYOUT,
])

function partnerNetThb(booking) {
  const settlement = extractSettlementSnapshot(booking)
  const price = parseFloat(booking?.price_thb) || 0
  const comm = parseFloat(booking?.commission_thb) || 0
  const net = Number.isFinite(parseFloat(settlement?.partner_net?.thb))
    ? parseFloat(settlement.partner_net.thb)
    : parseFloat(booking?.partner_earnings_thb) || price - comm
  return Math.round(net * 100) / 100
}

/**
 * @param {{ bookingId: string, disputeId: string, partnerId?: string }} args
 */
export async function applyDisputePayoutFreeze(args) {
  const bookingId = String(args.bookingId || '')
  const disputeId = String(args.disputeId || '')
  if (!bookingId || !disputeId || !supabaseAdmin) {
    return { success: false, error: 'invalid_input' }
  }

  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .select(
      'id, partner_id, status, price_thb, commission_thb, partner_earnings_thb, pricing_snapshot, metadata',
    )
    .eq('id', bookingId)
    .maybeSingle()
  if (error || !booking) return { success: false, error: error?.message || 'booking_not_found' }

  const partnerId = String(args.partnerId || booking.partner_id || '')
  const meta = booking.metadata && typeof booking.metadata === 'object' ? { ...booking.metadata } : {}
  meta.payout_blocked_by_dispute = true
  meta.payout_blocked_dispute_id = disputeId
  meta.payout_dispute_blocked_at = new Date().toISOString()

  await supabaseAdmin
    .from('bookings')
    .update({ metadata: meta, updated_at: new Date().toISOString() })
    .eq('id', bookingId)

  const st = String(booking.status || '')
  const net = partnerNetThb(booking)
  let ledger = { skipped: true }
  if (PAYOUT_STATUSES.has(st) && net > 0 && partnerId) {
    ledger = await postDisputePartnerFundsHold({
      bookingId,
      partnerId,
      amountThb: net,
      disputeId,
    })
  }

  if (partnerId) await EscrowService.syncPartnerBalanceColumns(partnerId)
  return { success: true, partnerNetThb: net, ledger }
}

/**
 * @param {{ bookingId: string, disputeId: string, resolutionReason?: string }} args
 */
export async function releaseDisputePayoutFreeze(args) {
  const bookingId = String(args.bookingId || '')
  const disputeId = String(args.disputeId || '')
  if (!bookingId || !disputeId || !supabaseAdmin) {
    return { success: false, error: 'invalid_input' }
  }

  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .select(
      'id, partner_id, status, price_thb, commission_thb, partner_earnings_thb, pricing_snapshot, metadata',
    )
    .eq('id', bookingId)
    .maybeSingle()
  if (error || !booking) return { success: false, error: error?.message || 'booking_not_found' }

  const partnerId = String(booking.partner_id || '')
  const meta = booking.metadata && typeof booking.metadata === 'object' ? { ...booking.metadata } : {}
  delete meta.payout_blocked_by_dispute
  delete meta.payout_blocked_dispute_id
  meta.payout_dispute_released_at = new Date().toISOString()
  meta.payout_dispute_release_reason = String(args.resolutionReason || '').slice(0, 500) || null

  await supabaseAdmin
    .from('bookings')
    .update({ metadata: meta, updated_at: new Date().toISOString() })
    .eq('id', bookingId)

  const net = partnerNetThb(booking)
  let ledger = { skipped: true }
  if (net > 0 && partnerId) {
    ledger = await postDisputePartnerFundsRelease({
      bookingId,
      partnerId,
      amountThb: net,
      disputeId,
      resolutionReason: args.resolutionReason,
    })
  }

  if (partnerId) await EscrowService.syncPartnerBalanceColumns(partnerId)
  return { success: true, partnerNetThb: net, ledger }
}

/**
 * Clear booking dispute metadata without crediting partner (guest refund path). Stage 141.
 * @param {{ bookingId: string, disputeId?: string, resolutionReason?: string }} args
 */
export async function clearDisputePayoutMetadata(args) {
  const bookingId = String(args.bookingId || '')
  if (!bookingId || !supabaseAdmin) {
    return { success: false, error: 'invalid_input' }
  }

  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .select('id, partner_id, metadata')
    .eq('id', bookingId)
    .maybeSingle()
  if (error || !booking) return { success: false, error: error?.message || 'booking_not_found' }

  const meta = booking.metadata && typeof booking.metadata === 'object' ? { ...booking.metadata } : {}
  delete meta.payout_blocked_by_dispute
  delete meta.payout_blocked_dispute_id
  meta.payout_dispute_released_at = new Date().toISOString()
  meta.payout_dispute_release_reason =
    String(args.resolutionReason || '').slice(0, 500) || 'guest_refund_resolution'

  await supabaseAdmin
    .from('bookings')
    .update({ metadata: meta, updated_at: new Date().toISOString() })
    .eq('id', bookingId)

  const partnerId = String(booking.partner_id || '')
  if (partnerId) await EscrowService.syncPartnerBalanceColumns(partnerId)
  return { success: true }
}
