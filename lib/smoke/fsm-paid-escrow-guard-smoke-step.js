/**
 * Stage 125.3 — smoke: direct transitionBookingStatus → PAID_ESCROW is forbidden.
 *
 * ⚠️ SMOKE FIXTURE (127.1): direct `bookings.status` UPDATE below is setup/teardown only —
 * never use in production; capture must go through EscrowService.moveToEscrow.
 */
import { supabaseAdmin } from '@/lib/supabase'
import { transitionBookingStatus } from '@/lib/services/booking/booking-status.service.js'
import { DIRECT_PAID_ESCROW_TRANSITION_ERROR } from '@/lib/booking/status-transitions.js'

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
    await supabaseAdmin
      .from('bookings')
      .update({ status: 'AWAITING_PAYMENT', updated_at: new Date().toISOString() })
      .eq('id', id)

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
    await supabaseAdmin
      .from('bookings')
      .update({ status: 'PAID_ESCROW', updated_at: new Date().toISOString() })
      .eq('id', id)
  }
}
