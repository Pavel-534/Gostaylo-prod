/**
 * Stage 111.1b — SSOT insert стандартной брони через RPC `create_booking_atomic_v1`.
 * Inquiry (INQUIRY) — прямой insert в inquiry.service (без резерва слотов).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js'
import { recordCriticalSignal } from '@/lib/critical-telemetry.js'

/**
 * @param {object} bookingInsertPayload — поля для RPC (как в creation.js)
 * @param {{ guestsCount: number, listingTimeZone: string, listingId: string }} ctx
 */
export async function insertBookingViaAtomicRpc(bookingInsertPayload, ctx) {
  const { guestsCount, listingTimeZone, listingId } = ctx

  const { data: atomicRows, error: atomicError } = await supabaseAdmin.rpc(
    'create_booking_atomic_v1',
    {
      p_listing_id: bookingInsertPayload.listing_id,
      p_renter_id: bookingInsertPayload.renter_id,
      p_partner_id: bookingInsertPayload.partner_id,
      p_status: bookingInsertPayload.status,
      p_check_in: bookingInsertPayload.check_in,
      p_check_out: bookingInsertPayload.check_out,
      p_price_thb: bookingInsertPayload.price_thb,
      p_currency: bookingInsertPayload.currency,
      p_price_paid: bookingInsertPayload.price_paid,
      p_exchange_rate: bookingInsertPayload.exchange_rate,
      p_commission_thb: bookingInsertPayload.commission_thb,
      p_commission_rate: bookingInsertPayload.commission_rate,
      p_applied_commission_rate: bookingInsertPayload.applied_commission_rate,
      p_partner_earnings_thb: bookingInsertPayload.partner_earnings_thb,
      p_taxable_margin_amount: bookingInsertPayload.taxable_margin_amount,
      p_rounding_diff_pot: bookingInsertPayload.rounding_diff_pot,
      p_net_amount_local: bookingInsertPayload.net_amount_local,
      p_listing_currency: bookingInsertPayload.listing_currency,
      p_guest_name: bookingInsertPayload.guest_name,
      p_guest_phone: bookingInsertPayload.guest_phone,
      p_guest_email: bookingInsertPayload.guest_email,
      p_special_requests: bookingInsertPayload.special_requests,
      p_guests_count: bookingInsertPayload.guests_count,
      p_promo_code_used: bookingInsertPayload.promo_code_used,
      p_discount_amount: bookingInsertPayload.discount_amount,
      p_pricing_snapshot: bookingInsertPayload.pricing_snapshot,
      p_metadata: bookingInsertPayload.metadata,
      p_requested_guests: guestsCount,
      p_listing_tz: listingTimeZone,
    },
  )

  if (atomicError) {
    const atomicMessage = String(atomicError.message || '')
    if (atomicMessage.includes('FOR UPDATE cannot be applied to the nullable side of an outer join')) {
      recordCriticalSignal('BOOKING_ATOMIC_FOR_UPDATE_OUTER_JOIN', {
        windowMs: 10 * 60 * 1000,
        threshold: 1,
        tag: '[BOOKING_DB_ERROR]',
        detailLines: [
          'create_booking_atomic_v1 failed due to FOR UPDATE + LEFT JOIN lock scope',
          `listing: ${listingId}`,
          `db_error: ${atomicMessage}`,
        ],
      })
    } else {
      void notifySystemAlert(
        `🧾 <b>Критическая ошибка: не удалось создать бронирование (БД)</b>\n` +
          `<code>${escapeSystemAlertHtml(atomicMessage)}</code>\n` +
          `listing: <code>${escapeSystemAlertHtml(listingId)}</code>`,
      )
    }
    if (
      atomicMessage.includes('VEHICLE_INTERVAL_CONFLICT') ||
      atomicMessage.includes('DATES_CONFLICT')
    ) {
      return {
        error: 'Dates not available',
        code: 'DATES_CONFLICT',
        conflictingBookings: [{ reason: 'INSUFFICIENT_CAPACITY' }],
      }
    }
    return { error: atomicError.message }
  }

  const atomic = Array.isArray(atomicRows) ? atomicRows[0] : null
  if (!atomic?.ok) {
    if (atomic?.conflict_code === 'DATES_CONFLICT') {
      return {
        error: 'Dates not available',
        code: 'DATES_CONFLICT',
        conflictingBookings: [{ reason: 'INSUFFICIENT_CAPACITY' }],
      }
    }
    return { error: atomic?.conflict_code || 'Atomic booking failed' }
  }

  return { bookingId: atomic.booking_id, insertedStatus: atomic.inserted_status }
}
