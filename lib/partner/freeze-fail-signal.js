/**
 * Server-only FREEZE_FAIL alert. Do not import from client UI modules.
 */

import { recordCriticalSignal } from '@/lib/critical-telemetry.js'
import { isFrozenBookingLookupFailed } from '@/lib/partner/partner-payout-eligibility.js'

/**
 * @param {Set<string> & { queryFailed?: boolean } | Set<string> | null | undefined} frozenSet
 * @param {string} [context]
 */
export function emitFreezeFailIfNeeded(frozenSet, context = 'unknown') {
  if (!isFrozenBookingLookupFailed(frozenSet)) return false
  recordCriticalSignal('FREEZE_FAIL', {
    severity: 'CRITICAL',
    tag: '[FINANCE]',
    threshold: 1,
    windowMs: 60 * 60 * 1000,
    detailLines: [
      '[FREEZE_FAIL] getFrozenBookingIdSet error — all payouts blocked until manual check',
      `context=${String(context).slice(0, 120)}`,
      `bookingIdsCount=${frozenSet?.size ?? 0}`,
    ],
  })
  return true
}
