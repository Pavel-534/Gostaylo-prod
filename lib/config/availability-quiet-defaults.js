/**
 * Stage 20.0 — listing-timezone quiet window when partner has not set personalized hours.
 * Stage 21.0: delayed **NEW_MESSAGE** FCM uses the same window via **`resolveSilentForPushDelivery`** (`lib/services/push/push-quiet-policy.js`) + **`resolvePartnerQuietContext`**.
 */
export const LISTING_QUIET_DEFAULT_START = '23:00'
export const LISTING_QUIET_DEFAULT_END = '08:00'
