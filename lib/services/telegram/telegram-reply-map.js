/**
 * Сохраняет связь Telegram message_id → conversation_id для reply-to-web.
 * Таблица: telegram_chat_reply_map (см. database/migrations/011_telegram_chat_reply_map.sql).
 */

import { telegramEnv } from './env.js'

/**
 * @param {string|number} telegramChatId
 * @param {number} telegramMessageId
 * @param {string} conversationId
 * @param {string} recipientUserId — profiles.id получателя уведомления
 */
export async function registerTelegramReplyTarget(
  telegramChatId,
  telegramMessageId,
  conversationId,
  recipientUserId
) {
  const { supabaseUrl, serviceKey } = telegramEnv()
  if (!supabaseUrl || !serviceKey) return false
  if (telegramMessageId == null || !conversationId || !recipientUserId) return false
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/telegram_chat_reply_map`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        telegram_chat_id: String(telegramChatId),
        telegram_message_id: Number(telegramMessageId),
        conversation_id: String(conversationId),
        recipient_user_id: String(recipientUserId),
      }),
    })
    if (!res.ok && res.status !== 409) {
      const err = await res.text().catch(() => '')
      console.warn('[telegram-reply-map] insert skipped:', res.status, err.slice(0, 200))
      return false
    }
    return true
  } catch (e) {
    console.warn('[telegram-reply-map]', e?.message || e)
    return false
  }
}

/**
 * @param {string|number} telegramChatId
 * @param {number} replyToMessageId
 * @returns {Promise<{ conversation_id: string, recipient_user_id: string } | null>}
 */
export async function lookupTelegramReplyTarget(telegramChatId, replyToMessageId) {
  const { supabaseUrl, serviceKey } = telegramEnv()
  if (!supabaseUrl || !serviceKey) return null
  try {
    const cid = encodeURIComponent(String(telegramChatId))
    const mid = encodeURIComponent(String(replyToMessageId))
    const res = await fetch(
      `${supabaseUrl}/rest/v1/telegram_chat_reply_map?telegram_chat_id=eq.${cid}&telegram_message_id=eq.${mid}&select=conversation_id,recipient_user_id&limit=1`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    )
    const rows = await res.json()
    const row = Array.isArray(rows) ? rows[0] : null
    if (!row?.conversation_id || !row?.recipient_user_id) return null
    return {
      conversation_id: String(row.conversation_id),
      recipient_user_id: String(row.recipient_user_id),
    }
  } catch (e) {
    console.warn('[telegram-reply-map] lookup', e?.message || e)
    return null
  }
}
