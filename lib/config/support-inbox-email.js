/**
 * Server-only ops inbox for product-feedback / internal notify emails.
 * Prefer SUPPORT_INBOX_EMAIL; alias PROCESS_SUPPORT_EMAIL.
 * Display/mailto address stays in getPublicSupportEmail (public env) — not here.
 */

export function getSupportInboxEmail() {
  const raw =
    process.env.SUPPORT_INBOX_EMAIL ?? process.env.PROCESS_SUPPORT_EMAIL ?? ''
  const v = String(raw).trim()
  if (!v) return null
  if (v.toLowerCase().endsWith('@example.com')) return null
  return v
}
