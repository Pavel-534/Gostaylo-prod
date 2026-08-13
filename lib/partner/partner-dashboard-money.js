/**
 * Partner overview money card — in-processing bucket (Stage 201.06).
 * Frozen escrow + 24h thaw hold. Never add pendingPayouts (that duplicated PAID_ESCROW).
 *
 * @param {{ frozenBalanceThb?: number, thawHoldBalanceThb?: number } | null | undefined} breakdown
 * @returns {number}
 */
export function resolvePartnerDashboardInProcessingThb(breakdown) {
  return Math.max(
    0,
    Number(breakdown?.frozenBalanceThb ?? 0) + Number(breakdown?.thawHoldBalanceThb ?? 0),
  )
}
