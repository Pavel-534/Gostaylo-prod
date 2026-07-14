/**
 * Partner withdraw CTA eligibility (Stage 186.2b) — pure logic for UI + tests.
 */
export function isPartnerWithdrawDisabled({
  summaryLoading,
  payoutPreviewLoading,
  partnerId,
  partnerProfileVerified,
  hasProfile,
  payoutPreview,
}) {
  const finalAmount = Number(payoutPreview?.finalAmountThb ?? 0)
  return (
    summaryLoading ||
    payoutPreviewLoading ||
    !partnerId ||
    partnerProfileVerified !== true ||
    !hasProfile ||
    !Number.isFinite(finalAmount) ||
    finalAmount <= 0
  )
}
