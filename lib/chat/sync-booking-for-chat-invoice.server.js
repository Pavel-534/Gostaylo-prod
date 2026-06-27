/**
 * Stage 173.1.0 — chat invoice Special Offer: sync booking price SSOT + INQUIRY → AWAITING_PAYMENT.
 *
 * Host invoice = commercial offer (Airbnb pre-approval). Guest must pass isBookingPayable / checkout.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { transitionBookingStatus } from '@/lib/services/booking/booking-status.service.js'
import { cloneBookingPricingSnapshot } from '@/lib/services/booking/pricing.service.js'
import { logStructured } from '@/lib/critical-telemetry.js'

/**
 * @param {object} params
 * @param {string} params.bookingId
 * @param {string} params.invoiceId
 * @param {number} params.amountThb — guest capture total (THB)
 * @param {object} params.commission — PricingService.calculateCommission result
 * @param {string} [params.hostUserId]
 * @returns {Promise<{ ok: boolean, transitioned?: boolean, error?: string }>}
 */
export async function syncBookingForPayableChatInvoice({
  bookingId,
  invoiceId,
  amountThb,
  commission,
  hostUserId = null,
}) {
  if (!bookingId || !supabaseAdmin) {
    return { ok: false, error: 'booking_required' }
  }

  const { data: booking, error: fetchErr } = await supabaseAdmin
    .from('bookings')
    .select(
      'id, status, price_thb, commission_thb, partner_earnings_thb, commission_rate, applied_commission_rate, rounding_diff_pot, pricing_snapshot, metadata, currency',
    )
    .eq('id', bookingId)
    .maybeSingle()

  if (fetchErr || !booking) {
    return { ok: false, error: fetchErr?.message || 'booking_not_found' }
  }

  const guestTotalThb = Math.round(Number(amountThb) || 0)
  const commissionThb = Math.round(Number(commission?.commissionThb) || 0)
  const partnerEarnings = Math.round(Number(commission?.partnerEarnings) || 0)
  const commissionRate = Number(commission?.commissionRate) || 0
  const subtotalThb = Math.max(0, guestTotalThb - commissionThb)

  const snapshot = cloneBookingPricingSnapshot(booking.pricing_snapshot)
  const nowIso = new Date().toISOString()
  snapshot.chat_invoice_quote = {
    invoice_id: String(invoiceId || ''),
    amount_thb: guestTotalThb,
    quoted_at: nowIso,
    source: 'chat_invoice_special_offer',
  }
  snapshot.fee_split_v2 = {
    ...(snapshot.fee_split_v2 && typeof snapshot.fee_split_v2 === 'object' ? snapshot.fee_split_v2 : {}),
    guest_service_fee_thb: commissionThb,
    host_commission_thb: Math.round(Number(commission?.hostCommissionThb) || 0),
    partner_netto_thb: partnerEarnings,
    host_commission_percent: commissionRate,
    guest_service_fee_percent: Number(commission?.guestServiceFeePercent) || 0,
    platform_gross_revenue_thb: Math.round(Number(commission?.platformGrossRevenueThb) || 0),
  }

  const pricePatch = {
    price_thb: subtotalThb,
    commission_thb: commissionThb,
    partner_earnings_thb: partnerEarnings,
    commission_rate: commissionRate,
    applied_commission_rate: commissionRate,
    pricing_snapshot: snapshot,
    updated_at: nowIso,
    metadata: {
      ...(booking.metadata && typeof booking.metadata === 'object' ? booking.metadata : {}),
      chat_invoice_id: String(invoiceId || ''),
      chat_invoice_amount_thb: guestTotalThb,
      chat_invoice_quoted_at: nowIso,
    },
  }

  const { error: upErr } = await supabaseAdmin.from('bookings').update(pricePatch).eq('id', bookingId)
  if (upErr) {
    logStructured({
      module: 'sync-booking-for-chat-invoice',
      stage: '173.1',
      level: 'error',
      error: upErr.message,
      bookingId,
      invoiceId,
    })
    return { ok: false, error: upErr.message }
  }

  const status = String(booking.status || '').toUpperCase()
  if (status !== 'INQUIRY') {
    return { ok: true, transitioned: false }
  }

  const tr = await transitionBookingStatus(bookingId, 'AWAITING_PAYMENT', {
    scope: 'system',
    actorContext: {
      actorId: hostUserId || null,
      actorRole: 'PARTNER',
      trigger: 'chat_invoice_special_offer',
    },
    metadata: { updatedAt: nowIso },
    extraPatch: {
      metadata: {
        ...(pricePatch.metadata || {}),
        chat_invoice_special_offer: true,
      },
    },
  })

  if (!tr.success) {
    logStructured({
      module: 'sync-booking-for-chat-invoice',
      stage: '173.1',
      level: 'error',
      error: tr.error || 'status_transition_failed',
      bookingId,
      invoiceId,
    })
    return { ok: false, error: tr.error || 'status_transition_failed' }
  }

  return { ok: true, transitioned: true }
}
