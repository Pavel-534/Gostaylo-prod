/** Stage 169.5 — guest viewed listings cookie (Wave G P2). No fingerprinting. */

export const GUEST_VIEWED_COOKIE_NAME = 'guest_viewed_listings'

/** Max stored views (task: 30–50). */
export const GUEST_VIEWED_MAX_ITEMS = 40

/** Item + cookie TTL (days). */
export const GUEST_VIEWED_TTL_DAYS = 30

export const GUEST_VIEWED_TTL_MS = GUEST_VIEWED_TTL_DAYS * 24 * 60 * 60 * 1000

/** Soft cap to keep cookie under ~4KB. */
export const GUEST_VIEWED_COOKIE_MAX_CHARS = 3200

export const GUEST_VIEWED_PAYLOAD_VERSION = 1
