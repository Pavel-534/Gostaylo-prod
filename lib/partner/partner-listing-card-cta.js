/**
 * Stage 201.90 — primary CTA on `/partner/listings` cards.
 * Ready drafts show Publish on the card; incomplete drafts keep Continue.
 */

/**
 * @param {object} input
 * @param {boolean} [input.trashMode]
 * @param {string} [input.status]
 * @param {boolean} [input.isDraftListing]
 * @param {boolean} [input.isConciergeDraft]
 * @param {boolean} [input.ready]
 * @param {boolean} [input.isHidden]
 * @returns {{
 *   showContinueDraft: boolean,
 *   showPublishCta: boolean,
 *   showConciergeReviewCta: boolean,
 * }}
 */
export function resolvePartnerListingCardCta({
  trashMode = false,
  status = '',
  isDraftListing = false,
  isConciergeDraft = false,
  ready = false,
  isHidden = false,
} = {}) {
  if (trashMode) {
    return {
      showContinueDraft: false,
      showPublishCta: false,
      showConciergeReviewCta: false,
    }
  }

  const showConciergeReviewCta = Boolean(isConciergeDraft)
  const showContinueDraft = Boolean(isDraftListing) && !showConciergeReviewCta && !ready
  const showPublishCta =
    !isHidden &&
    !showConciergeReviewCta &&
    ((Boolean(isDraftListing) && ready) ||
      (status === 'REJECTED' && ready) ||
      (status === 'INACTIVE' && !isDraftListing))

  return { showContinueDraft, showPublishCta, showConciergeReviewCta }
}
