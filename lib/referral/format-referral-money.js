/**
 * Форматирование сумм реферальной программы: базовая валюта платформы — THB,
 * группировка цифр и разделители — по локали пользователя (Intl).
 */

const LANG_TO_LOCALE = {
  ru: 'ru-RU',
  en: 'en-US',
  zh: 'zh-CN',
  th: 'th-TH',
}

/**
 * @param {string} languageOrLocale — код языка (`ru`) или полная локаль (`ru-RU`)
 * @returns {string}
 */
export function resolveReferralNumberLocale(languageOrLocale = 'ru') {
  const raw = String(languageOrLocale || '').trim()
  if (raw.includes('-')) return raw
  return LANG_TO_LOCALE[raw] || 'ru-RU'
}

/**
 * Сумма в THB для отображения на лендингах и в рефералке (без конвертации валют).
 * @param {number | string | null | undefined} amountThb
 * @param {string} languageOrLocale
 * @returns {string}
 */
export function formatReferralAmountThb(amountThb, languageOrLocale = 'ru') {
  const loc = resolveReferralNumberLocale(languageOrLocale)
  const n = Number(amountThb)
  const safe = Number.isFinite(n) ? n : 0
  const formatted = new Intl.NumberFormat(loc, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(safe)
  return `${formatted} THB`
}
