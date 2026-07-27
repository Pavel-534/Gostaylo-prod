/**
 * Stage 196.0-D — resolve GuestBookingNextSteps step (incl. day-of access branch).
 */

import { shouldShowCheckInAccessPack } from '@/lib/orders/check-in-access-pack'

/**
 * @param {{
 *   status?: string|null,
 *   checkInIso?: string|null,
 *   accessPackVisible?: boolean,
 *   now?: Date,
 * }} args
 * @returns {{
 *   key: string,
 *   messageKey: string,
 *   tone: 'amber'|'brand'|'emerald',
 *   icon: 'clock'|'card'|'chat'|'key',
 *   showPay: boolean,
 *   showChat: boolean,
 * }|null}
 */
export function resolveGuestNextStepsStep({
  status = null,
  checkInIso = null,
  accessPackVisible = false,
  now = new Date(),
} = {}) {
  const normalized = String(status || '').trim().toUpperCase()
  if (!normalized) return null

  const dayOf = shouldShowCheckInAccessPack(normalized, checkInIso, now)
  if (dayOf) {
    // Access Pack owns the primary surface; still nudge chat + access when pack is up.
    return {
      key: 'DAY_OF',
      messageKey: accessPackVisible
        ? 'guestNextSteps_dayOfWithPack'
        : 'guestNextSteps_dayOf',
      tone: 'emerald',
      icon: 'key',
      showPay: false,
      showChat: true,
    }
  }

  if (normalized === 'PENDING' || normalized === 'INQUIRY') {
    return {
      key: normalized,
      messageKey: 'guestNextSteps_pending',
      tone: 'amber',
      icon: 'clock',
      showPay: false,
      showChat: true,
    }
  }
  if (normalized === 'AWAITING_PAYMENT') {
    return {
      key: normalized,
      messageKey: 'guestNextSteps_awaitingPayment',
      tone: 'brand',
      icon: 'card',
      showPay: true,
      showChat: false,
    }
  }
  // Legacy escrow copy only when Access Pack not yet eligible (should be rare).
  if (normalized === 'PAID_ESCROW') {
    return {
      key: normalized,
      messageKey: 'guestNextSteps_paidEscrow',
      tone: 'emerald',
      icon: 'chat',
      showPay: false,
      showChat: true,
    }
  }
  return null
}
