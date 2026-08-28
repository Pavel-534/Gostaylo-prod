/**
 * Stage 202.13 — persist review ratings/comment in sessionStorage (not photos).
 */

const PREFIX = 'airento_review_draft:'

const EMPTY_RATINGS = Object.freeze({
  cleanliness: 0,
  accuracy: 0,
  communication: 0,
  location: 0,
  value: 0,
})

/**
 * @param {string | null | undefined} bookingId
 */
export function reviewDraftStorageKey(bookingId) {
  const id = String(bookingId || '').trim()
  return id ? `${PREFIX}${id}` : null
}

/**
 * @param {string | null | undefined} bookingId
 * @returns {{ ratings: Record<string, number>, comment: string } | null}
 */
export function loadReviewFormDraft(bookingId) {
  const key = reviewDraftStorageKey(bookingId)
  if (!key || typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const ratings =
      parsed.ratings && typeof parsed.ratings === 'object'
        ? { ...EMPTY_RATINGS, ...parsed.ratings }
        : { ...EMPTY_RATINGS }
    const comment = typeof parsed.comment === 'string' ? parsed.comment : ''
    return { ratings, comment }
  } catch {
    return null
  }
}

/**
 * @param {string | null | undefined} bookingId
 * @param {{ ratings?: Record<string, number>, comment?: string }} draft
 */
export function saveReviewFormDraft(bookingId, draft) {
  const key = reviewDraftStorageKey(bookingId)
  if (!key || typeof sessionStorage === 'undefined') return
  try {
    const ratings =
      draft?.ratings && typeof draft.ratings === 'object'
        ? { ...EMPTY_RATINGS, ...draft.ratings }
        : { ...EMPTY_RATINGS }
    const comment = typeof draft?.comment === 'string' ? draft.comment : ''
    const hasContent =
      comment.trim().length > 0 || Object.values(ratings).some((n) => Number(n) > 0)
    if (!hasContent) {
      sessionStorage.removeItem(key)
      return
    }
    sessionStorage.setItem(key, JSON.stringify({ ratings, comment, savedAt: Date.now() }))
  } catch {
    // quota / private mode — ignore
  }
}

/**
 * @param {string | null | undefined} bookingId
 */
export function clearReviewFormDraft(bookingId) {
  const key = reviewDraftStorageKey(bookingId)
  if (!key || typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(key)
  } catch {
    // ignore
  }
}
