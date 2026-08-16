/**
 * Stage 201.68 — SSOT public assets for transactional email chrome.
 *
 * Use **PNG** (not SVG) in email HTML — many clients (Outlook, Gmail web) strip or
 * break SVG `<img>`. Files live under `public/brand/` (designer lockups).
 *
 * Absolute URL = `getPublicSiteUrl()` + path (same as other email images).
 */

/** Horizontal lockup (mark + word) — primary email header. */
export const EMAIL_BRAND_LOCKUP_PUBLIC_PATH = '/brand/airento-lockup.png'

/** Mark-only fallback if lockup missing in a white-label fork. */
export const EMAIL_BRAND_MARK_PUBLIC_PATH = '/brand/airento-mark.png'

/** Display width in email header (height auto). */
export const EMAIL_BRAND_LOCKUP_WIDTH_PX = 168
