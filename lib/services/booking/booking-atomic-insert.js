/**
 * Stage 111.1b — SSOT insert стандартной брони через RPC `create_booking_atomic_v1`.
 * Inquiry (INQUIRY) — прямой insert в inquiry.service (без резерва слотов).
 * AUDIT_03 W3.4 — retry on lock_timeout / deadlock (max 3, exponential backoff).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js'
import { recordCriticalSignal } from '@/lib/critical-telemetry.js'

const ATOMIC_RPC_MAX_ATTEMPTS = 3
const ATOMIC_RPC_BASE_DELAY_MS = 100

/** PostgREST requires explicit null — omitted undefined breaks RPC signature match. */
function rpcText(value) {
  if (value === undefined || value === null) return null
  const s = String(value)
  return s.trim() === '' ? null : s
}

function rpcJson(value) {
  if (value === undefined || value === null) return {}
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return {}
  }
}

function isRetriableAtomicRpcError(message) {
  const m = String(message || '').toLowerCase()
  return (
    m.includes('lock_timeout') ||
    m.includes('deadlock') ||
    m.includes('40p01') ||
    m.includes('55p03') ||
    m.includes('could not obtain lock') ||
    m.includes('canceling statement due to lock timeout')
  )
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * @param {object} bookingInsertPayload — поля для RPC (как в creation.js)
 * @param {{ guestsCount: number, listingTimeZone: string, listingId: string }} ctx
 */
export async function insertBookingViaAtomicRpc(bookingInsertPayload, ctx) {
  const { guestsCount, listingTimeZone, listingId } = ctx

  const rpcArgs = {
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
    p_guest_name: rpcText(bookingInsertPayload.guest_name),
    p_guest_phone: rpcText(bookingInsertPayload.guest_phone),
    p_guest_email: rpcText(bookingInsertPayload.guest_email),
    p_special_requests: rpcText(bookingInsertPayload.special_requests),
    p_guests_count: bookingInsertPayload.guests_count,
    p_promo_code_used: rpcText(bookingInsertPayload.promo_code_used),
    p_discount_amount: bookingInsertPayload.discount_amount ?? 0,
    p_pricing_snapshot: rpcJson(bookingInsertPayload.pricing_snapshot),
    p_metadata: rpcJson(bookingInsertPayload.metadata),
    p_requested_guests: guestsCount,
    p_listing_tz: rpcText(listingTimeZone),
  }

  let atomicRows = null
  let atomicError = null
  let attempts = 0

  for (let attempt = 1; attempt <= ATOMIC_RPC_MAX_ATTEMPTS; attempt += 1) {
    attempts = attempt
    const res = await supabaseAdmin.rpc('create_booking_atomic_v1', rpcArgs)
    atomicRows = res.data
    atomicError = res.error
    if (!atomicError) break
    const msg = String(atomicError.message || '')
    if (!isRetriableAtomicRpcError(msg) || attempt >= ATOMIC_RPC_MAX_ATTEMPTS) break
    await sleep(ATOMIC_RPC_BASE_DELAY_MS * 2 ** (attempt - 1))
  }

  if (atomicError) {
    const atomicMessage = String(atomicError.message || '')
    if (isRetriableAtomicRpcError(atomicMessage) && attempts >= ATOMIC_RPC_MAX_ATTEMPTS) {
      recordCriticalSignal('BOOKING_ATOMIC_RPC_LOCK_RETRIES_EXHAUSTED', {
        severity: 'CRITICAL',
        windowMs: 10 * 60 * 1000,
        threshold: 1,
        tag: '[BOOKING_DB_ERROR]',
        detailLines: [
          `create_booking_atomic_v1 lock/deadlock after ${attempts} attempts`,
          `listing: ${listingId}`,
          `db_error: ${atomicMessage}`,
        ],
      })
    }
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
    } else if (!isRetriableAtomicRpcError(atomicMessage)) {
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
    return { error: atomicError.message, code: isRetriableAtomicRpcError(atomicMessage) ? 'BOOKING_LOCK_CONTENTION' : undefined }
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
