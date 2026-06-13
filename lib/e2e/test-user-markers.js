/**
 * Stage 117.3 — SSOT: маркеры тестовых / smoke / E2E профилей (без @/ — для Node-скриптов).
 */

/** Никогда не удалять (реальные аккаунты команды / E2E defaults). */
export const PROTECTED_TEST_CLEANUP_EMAILS = new Set([
  'pavel_534@mail.ru',
  '86boa@mail.ru',
  'pavel29031983@gmail.com',
  'pavel29031983@gmail.ru',
])

export const TEST_PROFILE_ID_PREFIXES = [
  'user-smoke-',
  'user-s72-',
  'user-x71-',
  'usr-e2e-ref133-',
  'smoke-guest-',
  'smoke-partner-',
  'test-user',
]

export const TEST_PROFILE_EMAIL_ILIKE = [
  '%@smoke.invalid',
  '%@test.gostaylo.invalid',
  '%test-user%',
]

/** PostgREST `.or()` для id. */
export function buildTestProfileIdOrFilter() {
  return [
    'id.like.user-smoke-%',
    'id.like.user-s72-%',
    'id.like.user-x71-%',
    'id.like.usr-e2e-ref133-%',
    'id.like.smoke-guest-%',
    'id.like.smoke-partner-%',
    'id.like.test-user-%',
  ].join(',')
}

export function normalizeCleanupEmail(v) {
  return String(v || '').trim().toLowerCase()
}

/**
 * @param {string | null | undefined} firstName
 */
export function isSyntheticUserLetterName(firstName) {
  const fn = String(firstName || '').trim()
  if (!fn) return false
  return /^User[A-Z0-9]{0,3}$/i.test(fn) && fn.length <= 6
}

function matchesSmokeHaystack(s) {
  const hay = String(s ?? '').toLowerCase()
  if (!hay) return false
  if (hay.includes('user-smoke') || hay.includes('@smoke.invalid')) return true
  if (hay.includes('stage104') || hay.includes('stage103') || hay.includes('financial-smoke')) return true
  if (/\bsmoke\b/.test(hay) && (hay.includes('stage') || hay.includes('test'))) return true
  return false
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 * @param {{ protectedEmails?: Set<string> }} [opts]
 */
export function isTestProfileRow(row, opts = {}) {
  if (!row || typeof row !== 'object') return false
  const id = String(row.id || '').trim()
  if (!id) return false

  const role = String(row.role || '').toUpperCase()
  if (role === 'ADMIN' || role === 'MODERATOR') return false

  const email = normalizeCleanupEmail(row.email)
  const protectedEmails = opts.protectedEmails || PROTECTED_TEST_CLEANUP_EMAILS
  if (email && protectedEmails.has(email)) return false

  if (TEST_PROFILE_ID_PREFIXES.some((p) => id.toLowerCase().startsWith(p.toLowerCase()))) return true

  if (email.endsWith('@smoke.invalid') || email.endsWith('@test.gostaylo.invalid')) return true
  if (email.includes('test-user') || email.includes('@smoke.')) return true

  const fn = String(row.first_name || row.firstName || '').trim()
  const ln = String(row.last_name || row.lastName || '').trim()
  if (/^Smoke/i.test(fn) || /^Smoke/i.test(ln)) return true
  if (isSyntheticUserLetterName(fn)) return true

  const full = String(row.full_name || row.name || '').trim()
  if (/^Smoke/i.test(full)) return true
  if (matchesSmokeHaystack(fn) || matchesSmokeHaystack(ln) || matchesSmokeHaystack(email)) return true

  return false
}
