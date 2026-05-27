/**
 * Stage 119.2 — SSOT смены статуса брони + обязательный referral-lifecycle-hook.
 */
import { supabaseAdmin } from '@/lib/supabase'
import { syncBookingStatusToConversationChat } from '@/lib/booking-status-chat-sync'
import {
  validatePartnerBookingStatusTransition,
  validateSystemBookingStatusTransition,
  isSystemBookingStatusTransitionAllowed,
} from '@/lib/booking/status-transitions.js'
import {
  BOOKING_SIMPLE_CANCEL_STATUSES,
} from '@/lib/booking/status-sets.js'
import { onBookingStatusTransition } from '@/lib/services/marketing/referral-lifecycle-hook.js'

/**
 * @typedef {'partner' | 'system' | 'cancel'} BookingStatusTransitionScope
 */

/**
 * @param {string} from
 * @param {string} to
 * @param {BookingStatusTransitionScope} scope
 * @param {{ allowStaffCancelCompleted?: boolean }} [options]
 */
function isCancelScopeTransitionAllowed(from, to, options = {}) {
  const fromSt = String(from || '').toUpperCase()
  const toSt = String(to || '').toUpperCase()
  if (toSt !== 'CANCELLED' && toSt !== 'REFUNDED') return false
  if (BOOKING_SIMPLE_CANCEL_STATUSES.has(fromSt)) return true
  if (fromSt === 'COMPLETED' && options.allowStaffCancelCompleted === true && toSt === 'CANCELLED') {
    return true
  }
  return isSystemBookingStatusTransitionAllowed(from, to)
}

/**
 * @param {string} from
 * @param {string} to
 * @param {BookingStatusTransitionScope} scope
 * @param {object} metadata
 */
function resolveTransitionPatch(from, to, scope, metadata = {}) {
  if (scope === 'partner') {
    return validatePartnerBookingStatusTransition(from, to, metadata)
  }
  if (scope === 'cancel') {
    if (!isCancelScopeTransitionAllowed(from, to, metadata)) {
      return { ok: false, error: `Cannot cancel/refund from ${from} to ${to}` }
    }
    const partnerTry = validatePartnerBookingStatusTransition(from, to, metadata)
    const systemTry = validateSystemBookingStatusTransition(from, to, metadata)
    const patch = partnerTry.ok
      ? partnerTry.patch
      : systemTry.ok
        ? systemTry.patch
        : buildCancelFallbackPatch(to, metadata)
    const extra =
      metadata.extraPatch && typeof metadata.extraPatch === 'object' ? metadata.extraPatch : {}
    return { ok: true, patch: { ...patch, ...extra } }
  }
  return validateSystemBookingStatusTransition(from, to, metadata)
}

function buildCancelFallbackPatch(toStatus, metadata = {}) {
  const now = metadata.updatedAt || new Date().toISOString()
  const toSt = String(toStatus || '').toUpperCase()
  const patch = { status: toSt, updated_at: now }
  if (toSt === 'CANCELLED') patch.cancelled_at = metadata.cancelledAt || now
  if (toSt === 'COMPLETED') patch.completed_at = metadata.completedAt || now
  return patch
}

/**
 * Единая точка смены статуса брони (Stage 119.2).
 *
 * @param {string} bookingId
 * @param {string} newStatus
 * @param {{
 *   scope?: BookingStatusTransitionScope,
 *   actorContext?: { actorId?: string, actorRole?: string, trigger?: string },
 *   metadata?: Record<string, unknown>,
 *   extraPatch?: Record<string, unknown>,
 *   allowStaffCancelCompleted?: boolean,
 *   skipChatSync?: boolean,
 *   skipReferralLifecycle?: boolean,
 *   previousStatusOverride?: string,
 *   skipDbUpdate?: boolean,
 *   forceDownstream?: boolean,
 *   select?: string,
 * }} [options]
 */
export async function transitionBookingStatus(bookingId, newStatus, options = {}) {
  const id = String(bookingId || '').trim()
  const toStatus = String(newStatus || '').trim().toUpperCase()
  if (!id) return { success: false, error: 'BOOKING_ID_REQUIRED' }
  if (!toStatus) return { success: false, error: 'STATUS_REQUIRED' }

  const scope = options.scope || 'partner'
  const meta = {
    ...(options.metadata && typeof options.metadata === 'object' ? options.metadata : {}),
    allowStaffCancelCompleted: options.allowStaffCancelCompleted === true,
    extraPatch: options.extraPatch,
    updatedAt: options.metadata?.updatedAt,
    cancelledAt: options.metadata?.cancelledAt,
    checkedInAt: options.metadata?.checkedInAt,
  }

  const select = options.select || '*'
  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .select(select)
    .eq('id', id)
    .maybeSingle()

  if (error) return { success: false, error: error.message || 'BOOKING_READ_FAILED' }
  if (!booking?.id) return { success: false, error: 'Booking not found' }

  const previousStatusFromDb = String(booking.status || '').toUpperCase()
  const previousStatusForLifecycle = options.previousStatusOverride
    ? String(options.previousStatusOverride || '').toUpperCase()
    : previousStatusFromDb

  if (previousStatusForLifecycle === toStatus && !options.forceDownstream) {
    return {
      success: true,
      skipped: true,
      reason: 'ALREADY_IN_STATUS',
      booking,
      previousStatus: previousStatusForLifecycle,
      newStatus: toStatus,
    }
  }

  const downstreamOnly = options.skipDbUpdate === true && options.forceDownstream === true

  let transition = { ok: true, patch: { status: toStatus, updated_at: meta.updatedAt || new Date().toISOString() } }
  if (!downstreamOnly) {
    transition = resolveTransitionPatch(previousStatusForLifecycle, toStatus, scope, meta)
    if (!transition.ok) {
      return {
        success: false,
        error: transition.error,
        previousStatus: previousStatusForLifecycle,
        newStatus: toStatus,
      }
    }
  }

  let updated = booking
  if (!options.skipDbUpdate) {
    const { data: updatedDb, error: updateError } = await supabaseAdmin
      .from('bookings')
      .update(transition.patch)
      .eq('id', id)
      .select(select)
      .single()

    if (updateError || !updatedDb) {
      return {
        success: false,
        error: updateError?.message || 'BOOKING_UPDATE_FAILED',
        previousStatus: previousStatusForLifecycle,
        newStatus: toStatus,
      }
    }
    updated = updatedDb
  }

  if (!options.skipChatSync) {
    try {
      await syncBookingStatusToConversationChat({
        bookingId: id,
        previousStatus: previousStatusForLifecycle,
        newStatus: toStatus,
        declineReasonKey: meta.declineReasonKey,
        declineReasonDetail: meta.declineReasonDetail,
        reasonFreeText: meta.reason,
      })
    } catch (e) {
      console.error('[BookingStatusService] chat sync', e)
    }
  }

  let referralLifecycle = null
  if (!options.skipReferralLifecycle) {
    try {
      const trigger =
        options.actorContext?.trigger ||
        meta.referralTrigger ||
        `booking_status_${scope}`
      referralLifecycle = await onBookingStatusTransition({
        bookingId: id,
        previousStatus: previousStatusForLifecycle,
        newStatus: toStatus,
        trigger,
        metadata: {
          ...meta,
          actorId: options.actorContext?.actorId || null,
          actorRole: options.actorContext?.actorRole || null,
        },
      })
    } catch (e) {
      console.error('[BookingStatusService] referral lifecycle', e)
      referralLifecycle = { success: false, error: e?.message || String(e) }
    }
  }

  return {
    success: true,
    booking: updated,
    previousStatus: previousStatusForLifecycle,
    newStatus: toStatus,
    referralLifecycle,
  }
}

export default { transitionBookingStatus }
