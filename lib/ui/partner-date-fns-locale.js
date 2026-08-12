/**
 * Partner date-fns locale map (wizard / hub calendars).
 * Stage 200.117 — shared by PartnerDateRangeFields.
 */

import { ru, enUS, zhCN, th as thDateLocale } from 'date-fns/locale'

export const PARTNER_DATE_FNS_LOCALES = {
  ru,
  en: enUS,
  zh: zhCN,
  th: thDateLocale,
}

/**
 * @param {string} [language]
 * @returns {import('date-fns').Locale}
 */
export function resolvePartnerDateFnsLocale(language) {
  return PARTNER_DATE_FNS_LOCALES[language] || ru
}
