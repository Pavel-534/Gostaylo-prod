/**
 * Stage 200.122 — PDP cancellation section anchor (trust strip → policies).
 */

export const LISTING_CANCELLATION_ANCHOR_ID = 'listing-cancellation-policy'

/**
 * Hash href for in-page jump to cancellation copy.
 * @returns {`#${typeof LISTING_CANCELLATION_ANCHOR_ID}`}
 */
export function listingCancellationAnchorHref() {
  return `#${LISTING_CANCELLATION_ANCHOR_ID}`
}
