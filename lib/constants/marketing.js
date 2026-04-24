/**
 * Stage 40.0 — defaults for marketing UI copy (Flash hot strip, etc.).
 * Overrides: `system_settings.key = marketing_ui_strings`, `value` = { ru: {...}, en: {...}, ... }.
 */

/** @typedef {'ru'|'en'|'zh'|'th'} MarketingUiLang */

/** Keys merged with DB (`marketing_ui_strings[lang]`) */
export const MARKETING_UI_STRING_KEYS = ['flashHotBookingsToday', 'flashHotExpiresIn']

/**
 * @type {Record<MarketingUiLang, Record<string, string>>}
 */
export const MARKETING_UI_STRING_DEFAULTS = {
  ru: {
    flashHotBookingsToday: '{{count}} чел. забронировали сегодня',
    flashHotExpiresIn: 'Истекает через {{hm}}',
  },
  en: {
    flashHotBookingsToday: '{{count}} guests booked today',
    flashHotExpiresIn: 'Ends in {{hm}}',
  },
  zh: {
    flashHotBookingsToday: '今天已有 {{count}} 人下单',
    flashHotExpiresIn: '{{hm}} 后结束',
  },
  th: {
    flashHotBookingsToday: 'วันนี้มี {{count}} ท่านจองแล้ว',
    flashHotExpiresIn: 'เหลืออีก {{hm}}',
  },
}

export const MARKETING_UI_LANGS = ['ru', 'en', 'zh', 'th']
