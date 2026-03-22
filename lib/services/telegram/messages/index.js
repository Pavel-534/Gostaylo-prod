import { telegramRu } from './ru.js'
import { telegramEn } from './en.js'

/**
 * @param {'ru' | 'en'} lang
 */
export function getTelegramMessages(lang) {
  return lang === 'ru' ? telegramRu : telegramEn
}
