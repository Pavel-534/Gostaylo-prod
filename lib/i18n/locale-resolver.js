/**
 * Locale SSOT (Stage 42.1) — канонический выбор UI-локали из профиля и общие константы языков веб+бот.
 * @see ARCHITECTURAL_DECISIONS.md — раздел Locale / preferred_language
 */

/** Единый список языков витрины и бота (совпадает с cookie/UI). */
export const SUPPORTED_UI_LANGUAGES = [
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'th', name: 'ไทย', flag: '🇹🇭' },
]

export const SUPPORTED_UI_LOCALE_CODES = SUPPORTED_UI_LANGUAGES.map((l) => l.code)

/** @typedef {'ru'|'en'|'zh'|'th'} UiLocale */

export const DEFAULT_UI_LOCALE = 'ru'

/**
 * Нормализует сырую строку локали к одному из поддерживаемых кодов.
 * @param {string | null | undefined} raw
 * @returns {UiLocale}
 */
export function normalizeUiLocaleCode(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .slice(0, 12)
  const two = s.slice(0, 2)
  if (SUPPORTED_UI_LOCALE_CODES.includes(two)) return /** @type {UiLocale} */ (two)
  return DEFAULT_UI_LOCALE
}

/**
 * SSOT: приоритет `preferred_language`, затем `language` (legacy).
 * @param {{ preferred_language?: string | null, language?: string | null } | null | undefined} profile
 * @returns {UiLocale}
 */
export function resolveUserLocale(profile) {
  if (!profile || typeof profile !== 'object') return DEFAULT_UI_LOCALE
  const pref = profile.preferred_language
  if (pref != null && String(pref).trim() !== '') {
    return normalizeUiLocaleCode(pref)
  }
  return normalizeUiLocaleCode(profile.language)
}

/**
 * Для Telegram-меню: zh/th используют английские подписи кнопок, пока нет полных переводов.
 * @param {UiLocale} locale
 * @returns {'ru'|'en'}
 */
export function telegramMenuButtonLocale(locale) {
  const l = normalizeUiLocaleCode(locale)
  if (l === 'ru') return 'ru'
  return 'en'
}

/**
 * Если профиля нет — язык из клиента Telegram (первый сегмент кода).
 * @param {string | undefined} telegramLanguageCode
 * @returns {UiLocale}
 */
export function resolveUiLocaleFromTelegramClientCode(telegramLanguageCode) {
  const code = String(telegramLanguageCode || '')
    .toLowerCase()
    .split(/[-_]/)[0]
  if (code === 'ru') return 'ru'
  if (code === 'zh') return 'zh'
  if (code === 'th') return 'th'
  if (code === 'en') return 'en'
  return 'en'
}
