/**
 * Stage 124.18 — smoke: checkout path after initiate (AWAITING_PAYMENT) → escrow RPC.
 * Simulates confirm/webhook outcome without HTTP (DB + EscrowService SSOT).
 */
import { supabaseAdmin } from '@/lib/supabase'
import EscrowService from '@/lib/services/escrow.service.js'
import { transitionBookingStatus } from '@/lib/services/booking/booking-status.service.js'

/**
 * @param {{
 *   bookingId: string,
 *   guestTotalThb: number,
 *   partnerNet: number,
 *   commissionThb: number,
 * }} params
 */
export async function runCheckoutAwaitingPaymentEscrowStep({
  bookingId,
  guestTotalThb,
  partnerNet,
  commissionThb,
}) {
  const id = String(bookingId || '').trim()
  if (!id) return { ok: false, error: 'bookingId required' }

  const now = new Date().toISOString()
  const statusRes = await transitionBookingStatus(id, 'AWAITING_PAYMENT', {
    scope: 'system',
    actorContext: { actorRole: 'SYSTEM', trigger: 'smoke_payment_initiate' },
    metadata: { updatedAt: now },
  })

  if (!statusRes.success) {
    return {
      ok: false,
      error:
        statusRes.error ||
        'AWAITING_PAYMENT transition failed — apply migrations/stage124_18_awaiting_payment_escrow_rpc.sql',
    }
  }

  const escrow = await EscrowService.moveToEscrow(id, {
    txId: `smoke-checkout-${Date.now()}`,
    gatewayRef: `smoke-gw-${Date.now()}`,
    source: 'smoke_checkout_confirm',
    captureGuestTotalThb: guestTotalThb,
  })

  if (!escrow?.success) {
    const err = String(escrow?.error || 'escrow failed')
    if (/invalid_status_transition|AWAITING_PAYMENT/i.test(err)) {
      return {
        ok: false,
        error: `${err} — apply migrations/stage124_18_awaiting_payment_escrow_rpc.sql on Supabase`,
      }
    }
    return { ok: false, error: err }
  }

  const { data: row, error } = await supabaseAdmin
    .from('bookings')
    .select('status, partner_earnings_thb')
    .eq('id', id)
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  if (String(row?.status || '').toUpperCase() !== 'PAID_ESCROW') {
    return { ok: false, error: `expected PAID_ESCROW, got ${row?.status}` }
  }

  return {
    ok: true,
    detail: `AWAITING_PAYMENT → PAID_ESCROW (partner ฿${partnerNet}, fee ฿${commissionThb})`,
  }
}
