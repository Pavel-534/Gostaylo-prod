/**
 * KYC files live in bucket `verification_documents`.
 * Same-origin `/_storage/...` rewrites to Supabase **public** objects (see next.config.js) — anyone with the path can fetch.
 * Admin UI should prefer `/api/v2/admin/verification-doc?path=...` which checks ADMIN and issues a short-lived signed URL.
 */

const PREFIX = '/_storage/verification_documents/'

/**
 * @param {string | null | undefined} storedUrl
 * @returns {string | null} object path inside bucket, e.g. `user-abc/file.jpg`
 */
export function extractVerificationDocumentsObjectPath(storedUrl) {
  if (!storedUrl || typeof storedUrl !== 'string') return null
  const u = storedUrl.trim()
  if (u.startsWith(PREFIX)) {
    return u.slice(PREFIX.length).replace(/^\/+/, '') || null
  }
  const marker = '/object/public/verification_documents/'
  const i = u.indexOf(marker)
  if (i !== -1) {
    return u.slice(i + marker.length).split('?')[0].replace(/^\/+/, '') || null
  }
  return null
}

function isSafeObjectPath(path) {
  if (!path || path.includes('..') || path.startsWith('/')) return false
  return /^[\w.-]+(?:\/[\w.-]+)*$/.test(path)
}

/**
 * @param {string | null | undefined} storedUrl — value from DB (`/_storage/...` or full Supabase public URL)
 * @returns {string} admin-protected viewer URL or original if not a verification_documents object
 */
export function toAdminVerificationDocProxyUrl(storedUrl) {
  const path = extractVerificationDocumentsObjectPath(storedUrl)
  if (!path || !isSafeObjectPath(path)) return storedUrl || ''
  return `/api/v2/admin/verification-doc?path=${encodeURIComponent(path)}`
}
