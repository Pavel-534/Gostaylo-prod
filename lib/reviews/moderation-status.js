/**
 * Stage 176.0 — SSOT moderation_status for guest + partner review tables.
 */

export const REVIEW_MODERATION_APPROVED = 'approved'
export const REVIEW_MODERATION_FLAGGED = 'flagged'
export const REVIEW_MODERATION_REMOVED = 'removed'

/** @typedef {'approved' | 'flagged' | 'removed'} ReviewModerationStatus */

export const REVIEW_MODERATION_STATUSES = Object.freeze([
  REVIEW_MODERATION_APPROVED,
  REVIEW_MODERATION_FLAGGED,
  REVIEW_MODERATION_REMOVED,
])

/**
 * @param {unknown} value
 * @returns {value is ReviewModerationStatus}
 */
export function isReviewModerationStatus(value) {
  return REVIEW_MODERATION_STATUSES.includes(value)
}

/**
 * @param {unknown} flagged
 * @returns {ReviewModerationStatus}
 */
export function moderationStatusFromContentGuard(flagged) {
  return flagged ? REVIEW_MODERATION_FLAGGED : REVIEW_MODERATION_APPROVED
}
