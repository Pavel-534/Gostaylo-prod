import { telegramEnv } from './env.js'
import { decodeTelegramText } from './telegram-text.js'
import { buildMainMenuReplyMarkup } from './inline-menu.js'
import { resolveMenuVariantForTelegramChat } from './menu-variant.js'

/**
 * Подмешать главное inline-меню к sendTelegram.
 * @param {'ru' | 'en'} lang
 * @param {object} [options]
 * @param {'partner' | 'renter' | 'guest'} [options.menuVariant] — если задано, БД не дергаем
 * @param {Record<string, unknown>} [options] — прочие поля для sendMessage (кроме menuVariant)
 */
export function withMainMenu(lang, options = {}) {
  const { menuVariant = 'guest', ...telegramOptions } = options
  return {
    ...telegramOptions,
    reply_markup: buildMainMenuReplyMarkup(lang, menuVariant),
  }
}

/**
 * Меню по telegram_id из Supabase (или переопределение через options.menuVariant).
 * @param {string | number} chatId
 */
export async function withMainMenuForChat(lang, chatId, options = {}) {
  const { menuVariant, ...telegramOptions } = options
  const variant = menuVariant ?? (await resolveMenuVariantForTelegramChat(chatId))
  return {
    ...telegramOptions,
    reply_markup: buildMainMenuReplyMarkup(lang, variant),
  }
}

/** Канонический URL вебхука (со слэшем в конце) — для setWebhook и диагностики */
export { getTelegramWebhookUrl } from '../../site-url.js'

let loggedMissingToken = false

/**
 * Send Telegram HTML message (parse_mode: HTML, UTF-8).
 * @returns {Promise<boolean>}
 */
export async function sendTelegram(chatId, text, options = {}) {
  const { botToken } = telegramEnv()
  if (!botToken) {
    if (!loggedMissingToken) {
      loggedMissingToken = true
      console.error(
        '[TELEGRAM] sendMessage skipped: TELEGRAM_BOT_TOKEN is not set (server env). Bot will stay silent until configured.'
      )
    }
    return false
  }
  const safeText = decodeTelegramText(text)
  try {
    const payload = {
      chat_id: chatId,
      text: safeText,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...options,
    }
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    })
    const data = await response.json().catch(() => ({}))
    if (!data.ok) {
      console.error('[TELEGRAM sendMessage]', data.error_code, data.description || response.statusText)
    }
    return Boolean(data.ok)
  } catch (e) {
    console.error('[TELEGRAM ERROR]', e.message)
    return false
  }
}

/** Короткий ответ на нажатие кнопки (без всплывающего окна). */
export async function answerCallbackDismiss(callbackId) {
  const { botToken } = telegramEnv()
  if (!botToken) return
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ callback_query_id: callbackId }),
    })
  } catch (e) {
    console.error('[answerCallbackDismiss ERROR]', e)
  }
}

export async function answerCallback(callbackId, text, { showAlert = true } = {}) {
  const { botToken } = telegramEnv()
  if (!botToken) return
  try {
    const body = { callback_query_id: callbackId, show_alert: showAlert }
    if (text) body.text = decodeTelegramText(text)
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
    })
  } catch (e) {
    console.error('[answerCallback ERROR]', e)
  }
}

export async function editTelegramMessage(chatId, messageId, text) {
  const { botToken } = telegramEnv()
  if (!botToken) return
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: decodeTelegramText(text),
        parse_mode: 'HTML',
      }),
    })
  } catch (e) {
    console.error('[editTelegramMessage ERROR]', e)
  }
}
