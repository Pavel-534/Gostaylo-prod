/**
 * Публичный @username бота для ссылок t.me (без токена).
 * Должен совпадать с «Имя пользователя» в профиле бота (не отображаемое имя).
 *
 * Vercel / .env (достаточно одной):
 * - NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=FunnyRent_777_bot
 * - NEXT_PUBLIC_TELEGRAM_BOT_NAME=FunnyRent_777_bot  (старый ключ, тоже читается)
 */

const DEFAULT_BOT_USERNAME = 'FunnyRent_777_bot'

export function getTelegramBotUsername() {
  const raw =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME) ||
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_TELEGRAM_BOT_NAME) ||
    DEFAULT_BOT_USERNAME
  const cleaned = String(raw).replace(/^@/, '').trim()
  return cleaned || DEFAULT_BOT_USERNAME
}

/** @param {string} startParam — лимит Telegram 64 символа */
export function telegramBotStartUrl(startParam) {
  const bot = getTelegramBotUsername()
  const p = String(startParam ?? '').trim()
  if (!p) return `https://t.me/${bot}`
  const safe = p.length > 64 ? p.slice(0, 64) : p
  return `https://t.me/${bot}?start=${encodeURIComponent(safe)}`
}

/** Одно нажатие: открыть бота с payload для привязки аккаунта (см. webhook /start link_<userId>). */
export function telegramAccountLinkUrl(userId) {
  const id = String(userId ?? '').trim()
  if (!id) return `https://t.me/${getTelegramBotUsername()}`
  return telegramBotStartUrl(`link_${id}`)
}
