/**
 * Stage 130.4 — Controlled Live soft limits + MIR ops touch (non-blocking).
 * Does not block checkout; TG alerts only (see controlled-live.js).
 */

import {
  maybeAlertDailyPilotLimitSoft,
  maybeAlertFirstRealPayment,
  loadControlledLiveState,
  getControlledLiveMaxThbPerDay,
} from '@/lib/treasury/controlled-live.js'

function normalizeMirMethod(method) {
  const m = String(method || '').toUpperCase().trim()
  if (m === 'MIR' || m === 'CARD_RU' || m === 'MIR_RU') return 'MIR'
  return m
}

/**
 * Soft pilot limit for MIR (TG warn when daily THB cap exceeded).
 * @param {{ booking?: object | null }} params
 */
export async function touchControlledLiveMirSoftLimit({ booking } = {}) {
  if (!booking?.id) return { skipped: true, reason: 'no_booking' }
  const method = normalizeMirMethod(booking?.metadata?.paymentMethod)
  if (method !== 'MIR') return { skipped: true, reason: 'not_mir' }
  return maybeAlertDailyPilotLimitSoft({ booking })
}

/**
 * After successful MIR capture — first-payment TG (idempotent in settings).
 * @param {{ booking?: object, payment?: object }} params
 */
export async function touchControlledLiveMirFirstPaymentAlert({ booking, payment } = {}) {
  if (!booking?.id) return { skipped: true, reason: 'no_booking' }
  const method = normalizeMirMethod(
    payment?.payment_method || payment?.method || booking?.metadata?.paymentMethod,
  )
  if (method !== 'MIR') return { skipped: true, reason: 'not_mir' }
  return maybeAlertFirstRealPayment({
    booking,
    payment: {
      ...(payment || {}),
      payment_method: 'MIR',
      method: 'MIR',
      source: payment?.source || 'payment_acquiring_webhook',
    },
  })
}

/**
 * Snapshot for admin / guards (no secrets).
 */
export async function getControlledLiveMirGuardSnapshot() {
  const state = await loadControlledLiveState()
  const maxThbPerDay = getControlledLiveMaxThbPerDay()
  return {
    controlledLiveActive: Boolean(state.active),
    maxThbPerDay,
    pilotLimitEnforced: maxThbPerDay > 0,
    firstPaymentRecorded: Boolean(state.firstPaymentBookingId),
  }
}
