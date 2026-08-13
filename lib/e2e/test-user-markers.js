/**
 * Stage 117.3 / 201.10 — SSOT: маркеры тестовых / smoke / E2E профилей (без @/ — для Node-скриптов).
 */

/** Никогда не удалять (реальные аккаунты команды). */
export const PROTECTED_TEST_CLEANUP_EMAILS = new Set([
  'pavel_534@mail.ru',
  '86boa@mail.ru',
  'pavel29031983@gmail.com',
  'pavel29031983@gmail.ru',
])

export const TEST_PROFILE_ID_PREFIXES = [
  'user-smoke-',
  'user-s72-',
  'user-s120-',
  'user-x71-',
  'user-phantom-',
  'usr-e2e-ref133-',
  'usr-stage',
  'smoke-guest-',
  'smoke-partner-',
  'test-user',
  'renter-test',
  'partner-test',
  'partner-1',
  'client-1',
  'moderator-1',
  'moderator-assistant-',
]

/** Disposable / seed domains — not used by live guests. */
export const TEST_PROFILE_EMAIL_SUFFIXES = [
  '@smoke.invalid',
  '@test.gostaylo.invalid',
  '@test.invalid',
  '@t.invalid',
  '@example.com',
  '@demo.com',
  '@test.com',
  '@funnyrent.com',
]

export const TEST_PROFILE_EMAIL_ILIKE = TEST_PROFILE_EMAIL_SUFFIXES.map((s) => `%${s}`).concat([
  '%test-user%',
])

/** PostgREST `.or()` для id. */
export function buildTestProfileIdOrFilter() {
  return TEST_PROFILE_ID_PREFIXES.map((p) => `id.like.${p}%`).join(',')
}

export function normalizeCleanupEmail(v) {
  return String(v || '').trim().toLowerCase()
}

export function isDisposableTestEmail(email) {
  const e = normalizeCleanupEmail(email)
  if (!e) return false
  return TEST_PROFILE_EMAIL_SUFFIXES.some((s) => e.endsWith(s))
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

  const email = normalizeCleanupEmail(row.email)
  const protectedEmails = opts.protectedEmails || PROTECTED_TEST_CLEANUP_EMAILS
  if (email && protectedEmails.has(email)) return false

  if (TEST_PROFILE_ID_PREFIXES.some((p) => id.toLowerCase().startsWith(p.toLowerCase()))) return true

  if (isDisposableTestEmail(email)) return true
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
