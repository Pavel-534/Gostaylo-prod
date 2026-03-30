import { telegramEnv } from './env.js'

let loggedMissingToken = false

/**
 * Send Telegram HTML message.
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
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...options,
      }),
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

export async function answerCallback(callbackId, text) {
  const { botToken } = telegramEnv()
  if (!botToken) return
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackId,
        text,
        show_alert: true,
      }),
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'HTML',
      }),
    })
  } catch (e) {
    console.error('[editTelegramMessage ERROR]', e)
  }
}
