/**
 * Stage 199.3 — detect unresolved i18n (raw key leak) and SCREAMING_SNAKE technical codes.
 */

/**
 * @param {string | null | undefined} resolved
 * @param {string | null | undefined} key
 */
export function isUnresolvedI18nKey(resolved, key) {
  if (key == null || key === '') return false
  const r = String(resolved ?? '').trim()
  const k = String(key).trim()
  if (!r) return true
  return r === k
}

/**
 * Technical API / machine codes that must not be shown raw to guests.
 * @param {string | null | undefined} text
 */
export function isTechnicalErrorCode(text) {
  const s = String(text || '').trim()
  if (!s) return false
  if (/^[A-Z][A-Z0-9_]{7,}$/.test(s)) return true
  if (/^[a-z][a-z0-9_]{7,}$/.test(s) && s.includes('_')) return true
  return false
}

/**
 * Prefer localized string; never return raw key or technical code.
 * @param {string} key
 * @param {string} language
 * @param {(k: string, lang: string, ctx?: object) => string} getUIText
 * @param {string} [fallback]
 * @param {object} [ctx]
 */
export function resolveFriendlyUiText(key, language, getUIText, fallback = '', ctx) {
  const msg = typeof getUIText === 'function' ? getUIText(key, language, ctx) : key
  if (!isUnresolvedI18nKey(msg, key) && !isTechnicalErrorCode(msg)) return msg
  if (fallback && !isTechnicalErrorCode(fallback) && !isUnresolvedI18nKey(fallback, key)) {
    return fallback
  }
  return fallback || ''
}
