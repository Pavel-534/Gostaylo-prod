/**
 * Stage 200 — structured fail logging for acquiring payment webhooks.
 */

import { logStructured, recordCriticalSignal } from '@/lib/critical-telemetry.js'
import { recordTreasuryWebhookError } from '@/lib/treasury/treasury-monitoring-alerts.js'

/**
 * @param {{
 *   error: unknown
 *   bookingId?: string | null
 *   paymentId?: string | null
 *   intentId?: string | null
 *   gatewayRef?: string | null
 *   adapterKey?: string | null
 *   stage?: string
 *   context?: string
 *   httpStatus?: number
 * }} payload
 */
export function logPaymentWebhookFailure(payload) {
  const error = String(payload?.error || 'webhook_failed')
  const stage = String(payload?.stage || 'payments_confirm')
  const bookingId = payload?.bookingId ? String(payload.bookingId) : null

  logStructured({
    event: 'payment_webhook_failure',
    channel: 'payments/confirm',
    stage,
    error,
    bookingId,
    paymentId: payload?.paymentId ? String(payload.paymentId) : undefined,
    intentId: payload?.intentId ? String(payload.intentId) : undefined,
    gatewayRef: payload?.gatewayRef ? String(payload.gatewayRef) : undefined,
    adapterKey: payload?.adapterKey ? String(payload.adapterKey) : undefined,
    httpStatus: payload?.httpStatus ?? undefined,
    context: payload?.context ? String(payload.context).slice(0, 500) : undefined,
  })

  recordCriticalSignal('PAYMENT_WEBHOOK_FAILURE', {
    severity: 'CRITICAL',
    detail: error,
    meta: {
      stage,
      bookingId,
      adapterKey: payload?.adapterKey || null,
      httpStatus: payload?.httpStatus ?? null,
    },
  })

  void recordTreasuryWebhookError({
    error,
    bookingId,
    context: [stage, payload?.context].filter(Boolean).join(' · ').slice(0, 400),
  })
}
