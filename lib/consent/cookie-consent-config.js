/**
 * Stage 202.18 — cookie consent policy version + categories SSOT.
 */

/** Bump to re-prompt all users after policy changes. */
export const COOKIE_CONSENT_POLICY_VERSION = 1

export const COOKIE_CONSENT_STORAGE_KEY = 'airento_cookie_consent'

/** Dispatched from `setStoredConsent` after localStorage write. */
export const COOKIE_CONSENT_EVENT = 'airento:cookie-consent'

/** Categories — analytics gated until explicit opt-in. */
export const CONSENT_CATEGORIES = Object.freeze({
  necessary: true,
  analytics: false,
})
