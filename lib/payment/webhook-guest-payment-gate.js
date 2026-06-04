/**
 * Stage 124.18 — production guest-payment guards for server webhooks (same policy as checkout initiate).
 */
import { logStructured } from '@/lib/critical-telemetry.js'
import { assertGuestPaymentOperationsAllowed } from '@/lib/payment/payment-production-guard.js'
import { touchControlledLiveMirSoftLimit } from '@/lib/payment/controlled-live-mir-guard.js'

/**
 * @param {{ bookingId?: string | null, channel: string, booking?: object | null, paymentMethod?: string }} ctx
 * @returns {Promise<{ allowed: boolean, code?: string, message?: string }>}
 */
export async function assertWebhookGuestPaymentAllowed(ctx) {
  const gate = await assertGuestPaymentOperationsAllowed({
    booking: ctx.booking || null,
    paymentMethod: ctx.paymentMethod || ctx.booking?.metadata?.paymentMethod || null,
  })
  const payload = {
    module: 'webhook-guest-payment-gate',
    channel: ctx.channel,
    bookingId: ctx.bookingId ? String(ctx.bookingId) : null,
    allowed: gate.allowed === true,
    code: gate.allowed ? null : gate.code || 'BLOCKED',
  }
  logStructured(payload)
  if (!gate.allowed) {
    return { allowed: false, code: gate.code, message: gate.message }
  }
  if (ctx.booking) {
    void touchControlledLiveMirSoftLimit({ booking: ctx.booking })
  }
  return { allowed: true, ops: gate.ops }
}
