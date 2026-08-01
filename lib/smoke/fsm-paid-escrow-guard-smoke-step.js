/**
 * Stage 125.3 — smoke: direct transitionBookingStatus → PAID_ESCROW is forbidden.
 *
 * Setup/teardown parks status outside the legal matrix via
 * `smokeForceBookingStatusNegativeTest` only (never in production paths).
 */
import { transitionBookingStatus } from '@/lib/services/booking/booking-status.service.js'
import { DIRECT_PAID_ESCROW_TRANSITION_ERROR } from '@/lib/booking/status-transitions.js'
import { smokeForceBookingStatusNegativeTest } from '@/lib/smoke/smoke-booking-status.js'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * @param {{ bookingId: string }} params
 */
export async function runFsmPaidEscrowGuardSmokeStep({ bookingId }) {
  const id = String(bookingId || '').trim()
  if (!id) return { ok: false, error: 'bookingId required' }
  if (process.env.SMOKE_FINANCIAL_RUN !== '1') {
    return { ok: false, error: 'SMOKE_FINANCIAL_RUN=1 required' }
  }

  const { data: booking } = await supabaseAdmin
    .from('bookings')
    .select('status')
    .eq('id', id)
    .maybeSingle()

  const st = String(booking?.status || '').toUpperCase()
  if (st !== 'PAID_ESCROW') {
    return { ok: false, error: `expected PAID_ESCROW before guard test, got ${st}` }
  }

  try {
    const park = await smokeForceBookingStatusNegativeTest(
      id,
      'AWAITING_PAYMENT',
      'negative_test:fsm_paid_escrow_guard_setup',
    )
    if (!park.success) return { ok: false, error: park.error || 'park AWAITING_PAYMENT failed' }

    const blocked = await transitionBookingStatus(id, 'PAID_ESCROW', {
      scope: 'system',
      actorContext: { actorRole: 'SYSTEM', trigger: 'smoke_125_3_direct' },
    })

    if (blocked.success) {
      return { ok: false, error: 'direct PAID_ESCROW transition should have failed' }
    }
    if (blocked.error !== DIRECT_PAID_ESCROW_TRANSITION_ERROR) {
      return {
        ok: false,
        error: `expected ${DIRECT_PAID_ESCROW_TRANSITION_ERROR}, got ${blocked.error}`,
      }
    }

    return {
      ok: true,
      detail: 'direct transitionBookingStatus → PAID_ESCROW blocked (use moveToEscrow RPC)',
    }
  } finally {
    await smokeForceBookingStatusNegativeTest(
      id,
      'PAID_ESCROW',
      'negative_test:fsm_paid_escrow_guard_restore',
    )
  }
}
