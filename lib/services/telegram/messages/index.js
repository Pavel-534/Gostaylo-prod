import { telegramRu } from './ru.js'
import { telegramEn } from './en.js'

/**
 * Тексты диалогов: ru — полный пакет; en/zh/th — en до отдельной локализации (Stage 42.1).
 * @param {'ru' | 'en' | 'zh' | 'th'} lang
 */
export function getTelegramMessages(lang) {
  if (lang === 'ru') return telegramRu
  return telegramEn
}

/**
 * Текст справки по роли (PARTNER/ADMIN — партнёрская; RENTER/GUEST — арендатор).
 * @param {typeof telegramRu} t
 * @param {'ru' | 'en' | 'zh' | 'th'} lang
 * @param {'partner' | 'renter' | 'guest'} menuVariant
 */
export function getHelpHtmlForMenuVariant(t, lang, menuVariant) {
  return menuVariant === 'partner' ? t.help_partner(lang) : t.help_renter(lang)
}

/**
 * Текст /start: partner — полный онбординг; renter и guest — короткое приветствие арендатора.
 * @param {typeof telegramRu} t
 * @param {'ru' | 'en' | 'zh' | 'th'} lang
 * @param {'partner' | 'renter' | 'guest'} menuVariant
 * @param {string} firstName
 */
export function getStartHtmlForMenuVariant(t, lang, menuVariant, firstName) {
  return menuVariant === 'partner'
    ? t.start_partner(firstName, lang)
    : t.start_renter(firstName, lang)
}
