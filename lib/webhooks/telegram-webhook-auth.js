/**
 * Stage 154.3 — Telegram webhook Lite-Protection (no secret_token / manual setWebhook).
 * Structural validation only — no DB, no Telegram API round-trips.
 */

/** @param {unknown} value */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * @param {string | undefined | null} botToken
 * @returns {{ ok: true, botId: string } | { ok: false, status: number, error: string }}
 */
export function assertTelegramBotTokenConfigured(botToken) {
  const token = String(botToken || '').trim()
  if (!token) {
    return { ok: false, status: 503, error: 'bot_token_not_configured' }
  }
  const match = token.match(/^(\d{8,10}):([A-Za-z0-9_-]{30,})$/)
  if (!match) {
    return { ok: false, status: 503, error: 'bot_token_invalid_format' }
  }
  return { ok: true, botId: match[1] }
}

/**
 * @param {unknown} update
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validateTelegramUpdateShape(update) {
  if (!isPlainObject(update)) {
    return { ok: false, error: 'invalid_update_object' }
  }

  const updateId = update.update_id
  if (typeof updateId !== 'number' || !Number.isFinite(updateId) || updateId < 0) {
    return { ok: false, error: 'invalid_update_id' }
  }

  const hasMessage = isPlainObject(update.message)
  const hasCallback = isPlainObject(update.callback_query)
  if (!hasMessage && !hasCallback) {
    return { ok: false, error: 'missing_message_or_callback_query' }
  }

  if (hasMessage) {
    if (typeof update.message.message_id !== 'number' || !Number.isFinite(update.message.message_id)) {
      return { ok: false, error: 'invalid_message' }
    }
    if (!isPlainObject(update.message.chat)) {
      return { ok: false, error: 'invalid_message_chat' }
    }
    if (typeof update.message.chat.id !== 'number' && typeof update.message.chat.id !== 'string') {
      return { ok: false, error: 'invalid_message_chat_id' }
    }
  }

  if (hasCallback) {
    if (typeof update.callback_query.id !== 'string' || !update.callback_query.id.trim()) {
      return { ok: false, error: 'invalid_callback_query' }
    }
    if (!isPlainObject(update.callback_query.from)) {
      return { ok: false, error: 'invalid_callback_query_from' }
    }
  }

  return { ok: true }
}

/**
 * Lite gate: configured bot token + Telegram update shape.
 * @param {unknown} update
 * @param {string | undefined | null} botToken
 * @returns {{ ok: true } | { ok: false, status: number, error: string }}
 */
export function validateTelegramWebhookLite(update, botToken) {
  const tokenGate = assertTelegramBotTokenConfigured(botToken)
  if (!tokenGate.ok) {
    return tokenGate
  }

  const shape = validateTelegramUpdateShape(update)
  if (!shape.ok) {
    return { ok: false, status: 400, error: shape.error }
  }

  return { ok: true }
}
