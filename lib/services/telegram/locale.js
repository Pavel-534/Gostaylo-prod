/**
 * Язык UI Telegram-бота: ru | en | zh | th (как на сайте).
 * Канон выбора из профиля — `resolveUserLocale` в `lib/i18n/locale-resolver.js`.
 */

import { telegramEnv } from './env.js'
import {
  resolveUserLocale,
  resolveUiLocaleFromTelegramClientCode,
} from '@/lib/i18n/locale-resolver.js'

/**
 * Fallback по `language_code` клиента Telegram, если профиля нет или локаль не задана.
 * @param {string | undefined} telegramLanguageCode
 * @returns {'ru'|'en'|'zh'|'th'}
 */
export function normalizeTelegramUiLang(telegramLanguageCode) {
  return resolveUiLocaleFromTelegramClientCode(telegramLanguageCode)
}

/**
 * @param {{ preferred_language?: string | null, language?: string | null, profileLanguage?: string | null, telegramLanguageCode?: string }} opts
 * @returns {'ru'|'en'|'zh'|'th'}
 */
export function resolveTelegramLang({
  preferred_language,
  language,
  profileLanguage,
  telegramLanguageCode,
}) {
  const pref = preferred_language != null && String(preferred_language).trim() !== '' ? preferred_language : null
  const lang = language != null && String(language).trim() !== '' ? language : null
  const legacy = profileLanguage != null && String(profileLanguage).trim() !== '' ? profileLanguage : null
  if (!pref && !lang && !legacy) {
    return normalizeTelegramUiLang(telegramLanguageCode)
  }
  return resolveUserLocale({
    preferred_language: pref,
    language: lang ?? legacy,
  })
}

/**
 * Читает `preferred_language` + `language` по telegram_id.
 * @param {string|number} chatId
 * @param {string} [telegramLanguageCode] — message.from.language_code
 * @returns {Promise<'ru'|'en'|'zh'|'th'>}
 */
export async function resolveTelegramLanguageForChat(chatId, telegramLanguageCode) {
  const { supabaseUrl, serviceKey } = telegramEnv()
  if (!supabaseUrl || !serviceKey) {
    return normalizeTelegramUiLang(telegramLanguageCode)
  }
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/profiles?telegram_id=eq.${chatId}&select=preferred_language,language`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    )
    const rows = await res.json()
    const row = Array.isArray(rows) ? rows[0] : null
    if (!row) {
      return normalizeTelegramUiLang(telegramLanguageCode)
    }
    return resolveUserLocale(row)
  } catch {
    return normalizeTelegramUiLang(telegramLanguageCode)
  }
}

/**
 * Подписи ролей для сообщений бота (zh/th → английские подписи до полной локализации).
 * @param {string} role
 * @param {'ru'|'en'|'zh'|'th'} lang
 */
export function telegramPartnerRoleLabel(role, lang) {
  const useRu = lang === 'ru'
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
  const map = useRu ? ru : en
  return map[role] || role
}
