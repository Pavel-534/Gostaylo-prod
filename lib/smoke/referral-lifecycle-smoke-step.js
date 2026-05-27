/**
 * Stage 119.1 — smoke: идемпотентность promo tank reversal + lifecycle revert (noop-safe).
 */
import { ReferralPromoTankReversalService } from '@/lib/services/marketing/referral-promo-tank-reversal.service.js'
import ReferralLedgerService from '@/lib/services/marketing/referral-ledger.service.js'
import { onBookingStatusTransition } from '@/lib/services/marketing/referral-lifecycle-hook.js'

function step(name) {
  return { name, ok: false, detail: '', durationMs: 0 }
}

function markDuration(s, t0) {
  s.durationMs = Math.max(0, Date.now() - t0)
}

function pass(s, detail, t0) {
  s.ok = true
  s.detail = detail
  markDuration(s, t0)
  return s
}

function fail(s, detail, t0) {
  s.ok = false
  s.detail = String(detail || 'failed').slice(0, 500)
  markDuration(s, t0)
  return s
}

/** @returns {Promise<{ name: string, ok: boolean, detail: string, durationMs: number }>} */
export async function runReferralLifecycleSmokeStep() {
  const s = step('Referral 119.1 lifecycle + promo reversal')
  const t0 = Date.now()
  try {
    const noopBookingId = `bk-smoke-119-${Date.now().toString(36)}`
    const promo1 = await ReferralPromoTankReversalService.revertPromoTankDebitsForBooking(noopBookingId, {
      trigger: 'smoke_119_1',
    })
    if (promo1.success !== true) return fail(s, promo1.error || 'promo_reversal_failed', t0)

    const promo2 = await ReferralPromoTankReversalService.revertPromoTankDebitsForBooking(noopBookingId, {
      trigger: 'smoke_119_1_repeat',
    })
    if (promo2.success !== true) return fail(s, promo2.error || 'promo_reversal_repeat_failed', t0)

    const revert = await ReferralLedgerService.revertReferralLedgerForBooking(noopBookingId, {
      trigger: 'smoke_119_1',
    })
    if (revert.success === false) return fail(s, revert.error || 'revert_failed', t0)

    const lifecycle = await onBookingStatusTransition({
      bookingId: noopBookingId,
      previousStatus: 'COMPLETED',
      newStatus: 'CANCELLED',
      trigger: 'smoke_119_1_lifecycle',
    })
    if (lifecycle.success === false) return fail(s, lifecycle.error || 'lifecycle_failed', t0)

    return pass(
      s,
      `noop revert OK; promo skipped=${promo1.skipped === true}; clawback=${revert.clawback?.reason || 'none'}`,
      t0,
    )
  } catch (e) {
    return fail(s, e?.message || String(e), t0)
  }
}
