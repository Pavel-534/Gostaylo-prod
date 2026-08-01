/**
 * Smoke / E2E booking status helpers (AUDIT_MONEY_FLOW_04).
 *
 * Prefer `smokeTransitionBookingStatus` (FSM). Raw force only for negative tests
 * that must park outside the legal matrix (e.g. Stage 125.3 PAID_ESCROW guard).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { transitionBookingStatus } from '@/lib/services/booking/booking-status.service.js'

function smokeOrE2eEnabled() {
  return (
    process.env.SMOKE_FINANCIAL_RUN === '1' ||
    process.env.E2E_TEST_RUN === '1' ||
    process.env.SMOKE_LEDGER_RUN === '1'
  )
}

/**
 * Legal FSM transition for fixtures (system scope by default).
 * @param {string} bookingId
 * @param {string} toStatus
 * @param {{
 *   scope?: 'partner' | 'system' | 'cancel',
 *   trigger?: string,
 *   actorId?: string | null,
 *   metadata?: Record<string, unknown>,
 *   extraPatch?: Record<string, unknown>,
 *   skipReferralLifecycle?: boolean,
 *   skipChatSync?: boolean,
 * }} [opts]
 */
export async function smokeTransitionBookingStatus(bookingId, toStatus, opts = {}) {
  const id = String(bookingId || '').trim()
  const to = String(toStatus || '').trim().toUpperCase()
  if (!id || !to) return { success: false, error: 'bookingId_and_status_required' }

  return transitionBookingStatus(id, to, {
    scope: opts.scope || 'system',
    actorContext: {
      actorId: opts.actorId || null,
      actorRole: opts.scope === 'partner' ? 'PARTNER' : 'SYSTEM',
      trigger: opts.trigger || `smoke_transition_${to.toLowerCase()}`,
    },
    metadata: {
      ...(opts.metadata && typeof opts.metadata === 'object' ? opts.metadata : {}),
      smoke: true,
    },
    extraPatch: opts.extraPatch,
    // Fixtures often use @smoke.invalid users — skip marketing/chat noise by default.
    skipReferralLifecycle: opts.skipReferralLifecycle !== false,
    skipChatSync: opts.skipChatSync !== false,
  })
}

/**
 * PAID_ESCROW → THAWED → READY_FOR_PAYOUT with optional thaw metadata (system matrix).
 * @param {string} bookingId
 * @param {{
 *   thawAtIso?: string,
 *   metadata?: Record<string, unknown>,
 *   trigger?: string,
 *   extraPatch?: Record<string, unknown>,
 * }} [opts]
 */
export async function smokePromoteEscrowToReadyForPayout(bookingId, opts = {}) {
  const id = String(bookingId || '').trim()
  if (!id) return { success: false, error: 'bookingId_required' }

  const { data: row, error: readErr } = await supabaseAdmin
    .from('bookings')
    .select('status')
    .eq('id', id)
    .maybeSingle()
  if (readErr) return { success: false, error: readErr.message }

  let st = String(row?.status || '').toUpperCase()
  if (st === 'READY_FOR_PAYOUT') {
    return { success: true, skipped: true, reason: 'ALREADY_READY', previousStatus: st, newStatus: st }
  }

  const thawAt = opts.thawAtIso || new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  const metaPatch = {
    escrow_thawed_at: thawAt,
    escrow_thaw_at: thawAt,
    ...(opts.metadata && typeof opts.metadata === 'object' ? opts.metadata : {}),
  }
  const thawExtra = {
    metadata: metaPatch,
    ...(opts.extraPatch && typeof opts.extraPatch === 'object' ? opts.extraPatch : {}),
  }

  if (st === 'PAID_ESCROW') {
    const thawed = await smokeTransitionBookingStatus(id, 'THAWED', {
      scope: 'system',
      trigger: opts.trigger || 'smoke_force_thaw',
      extraPatch: thawExtra,
    })
    if (!thawed.success && !thawed.skipped) return thawed
    st = 'THAWED'
  }

  if (st !== 'THAWED') {
    return { success: false, error: `unexpected_status_for_ready_promote:${st}` }
  }

  return smokeTransitionBookingStatus(id, 'READY_FOR_PAYOUT', {
    scope: 'system',
    trigger: opts.trigger || 'smoke_force_ready',
    extraPatch: { metadata: metaPatch },
  })
}

/**
 * Escape hatch: illegal / setup status write for **negative tests only**.
 * Requires SMOKE_FINANCIAL_RUN or E2E_TEST_RUN and reason starting with `negative_test:`.
 *
 * @param {string} bookingId
 * @param {string} toStatus
 * @param {string} reason — must start with `negative_test:`
 * @param {Record<string, unknown>} [extraPatch]
 */
export async function smokeForceBookingStatusNegativeTest(bookingId, toStatus, reason, extraPatch = {}) {
  if (!smokeOrE2eEnabled()) {
    throw new Error('smokeForceBookingStatusNegativeTest requires SMOKE_FINANCIAL_RUN or E2E_TEST_RUN')
  }
  const why = String(reason || '')
  if (!why.startsWith('negative_test:')) {
    throw new Error('smokeForceBookingStatusNegativeTest reason must start with negative_test:')
  }
  const id = String(bookingId || '').trim()
  const to = String(toStatus || '').trim().toUpperCase()
  if (!id || !to) throw new Error('bookingId_and_status_required')

  console.warn(
    `[smoke-booking-status] NEGATIVE_TEST force status=${to} booking=${id} reason=${why}`,
  )

  const { error } = await supabaseAdmin
    .from('bookings')
    .update({
      status: to,
      updated_at: new Date().toISOString(),
      ...extraPatch,
    })
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  return { success: true, forced: true, status: to, reason: why }
}
