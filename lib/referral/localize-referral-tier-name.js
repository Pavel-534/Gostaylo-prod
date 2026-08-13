/**
 * Stage 200.133 — user-facing referral tier labels (DB keeps Beginner/Pro/Ambassador).
 */

const TIER_I18N = {
  beginner: 'stage73_tierFallbackBeginner',
  pro: 'stage73_tierFallbackPro',
  ambassador: 'stage73_tierFallbackAmbassador',
}

/**
 * @param {string | null | undefined} name — raw tier name from API/DB
 * @param {(key: string) => string} t — getUIText binder
 * @returns {string}
 */
export function localizeReferralTierName(name, t) {
  const raw = String(name || '').trim()
  const key = TIER_I18N[raw.toLowerCase()]
  if (key && typeof t === 'function') {
    const localized = t(key)
    if (localized && localized !== key) return localized
  }
  if (!raw) {
    return typeof t === 'function' ? t('stage73_tierFallbackBeginner') : 'Новичок'
  }
  return raw
}

export default { localizeReferralTierName }
