/**
 * Язык UI Telegram-бота: ru | en.
 * Приоритет: profiles.language → language_code клиента Telegram.
 * Не-ru языки профиля (zh, th, …) → en в боте.
 */

import { telegramEnv } from './env.js'

/** @typedef {'ru' | 'en'} TelegramUiLang */

/**
 * По коду Telegram: только ru → русский шаблон, иначе английский.
 * @param {string | undefined} telegramLanguageCode
 * @returns {TelegramUiLang}
 */
export function normalizeTelegramUiLang(telegramLanguageCode) {
  const code = String(telegramLanguageCode || '')
    .toLowerCase()
    .split(/[-_]/)[0]
  return code === 'ru' ? 'ru' : 'en'
}

/**
 * @param {{ profileLanguage?: string | null, telegramLanguageCode?: string }} opts
 * @returns {TelegramUiLang}
 */
export function resolveTelegramLang({ profileLanguage, telegramLanguageCode }) {
  const p = profileLanguage ? String(profileLanguage).toLowerCase().split(/[-_]/)[0] : ''
  if (p === 'ru') return 'ru'
  if (p && p !== 'ru') {
    return 'en'
  }
  return normalizeTelegramUiLang(telegramLanguageCode)
}

/**
 * Читает profiles.language по telegram_id и возвращает язык сообщений.
 * @param {string|number} chatId
 * @param {string} [telegramLanguageCode] — message.from.language_code
 * @returns {Promise<TelegramUiLang>}
 */
export async function resolveTelegramLanguageForChat(chatId, telegramLanguageCode) {
  const { supabaseUrl, serviceKey } = telegramEnv()
  if (!supabaseUrl || !serviceKey) {
    return normalizeTelegramUiLang(telegramLanguageCode)
  }
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/profiles?telegram_id=eq.${chatId}&select=language`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    )
    const rows = await res.json()
    const profileLanguage = rows?.[0]?.language
    return resolveTelegramLang({ profileLanguage, telegramLanguageCode })
  } catch {
    return normalizeTelegramUiLang(telegramLanguageCode)
  }
}

/**
 * Подписи ролей для сообщений бота.
 * @param {string} role
 * @param {TelegramUiLang} lang
 */
export function telegramPartnerRoleLabel(role, lang) {
  const ru = {
    ADMIN: 'Администратор',
    PARTNER: 'Партнёр',
    RENTER: 'Арендатор',
    MODERATOR: 'Модератор',
  }
  const en = {
    ADMIN: 'Administrator',
    PARTNER: 'Partner',
    RENTER: 'Renter',
    MODERATOR: 'Moderator',
  }
  const map = lang === 'ru' ? ru : en
  return map[role] || role
}
