/**
 * Ответ (reply) на уведомление бота о сообщении в чате → запись в messages без OpenAI.
 */

import { telegramEnv } from '../env.js'
import { sendTelegram, withMainMenuForChat } from '../api.js'
import { getTelegramMessages } from '../messages/index.js'
import { lookupTelegramReplyTarget } from '../telegram-reply-map.js'
import {
  canWriteConversation,
  effectiveRoleFromProfile,
  isStaffRole,
  userParticipatesInConversation,
} from '../../chat/access.js'
import { buildLocalizedSiteUrl } from '../../../site-url.js'

const hdr = (serviceKey) => ({
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
})

async function fetchProfileByTelegram(telegramUserId, supabaseUrl, serviceKey) {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/profiles?telegram_id=eq.${encodeURIComponent(String(telegramUserId))}&select=id,role,first_name,last_name,email`,
    { headers: hdr(serviceKey) }
  )
  const rows = await res.json()
  return Array.isArray(rows) ? rows[0] : null
}

async function fetchConversationRow(conversationId, supabaseUrl, serviceKey) {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/conversations?id=eq.${encodeURIComponent(conversationId)}&select=*`,
    { headers: hdr(serviceKey) }
  )
  const rows = await res.json()
  return Array.isArray(rows) ? rows[0] : null
}

/**
 * @returns {Promise<boolean>} true если апдейт обработан (не передавать в «свободный текст»)
 */
export async function handleInboundTelegramChatReply(message, lang) {
  const reply = message.reply_to_message
  if (!reply?.message_id) return false

  const text = String(message.text || '').trim()
  if (!text || text.startsWith('/')) return false

  const chatId = message.chat?.id
  const fromTgId = message.from?.id
  if (chatId == null || fromTgId == null) return false

  const target = await lookupTelegramReplyTarget(chatId, reply.message_id)
  if (!target) return false

  const t = getTelegramMessages(lang)
  const { supabaseUrl, serviceKey } = telegramEnv()
  if (!supabaseUrl || !serviceKey) {
    await sendTelegram(chatId, t.chatReplyFailed(), await withMainMenuForChat(lang, chatId))
    return true
  }

  const profile = await fetchProfileByTelegram(fromTgId, supabaseUrl, serviceKey)
  if (!profile || String(profile.id) !== String(target.recipient_user_id)) {
    await sendTelegram(chatId, t.chatReplyForbidden(), await withMainMenuForChat(lang, chatId))
    return true
  }

  const conversation = await fetchConversationRow(target.conversation_id, supabaseUrl, serviceKey)
  if (!conversation) {
    await sendTelegram(chatId, t.chatReplyFailed(), await withMainMenuForChat(lang, chatId))
    return true
  }

  const accessRole = effectiveRoleFromProfile(profile)
  if (isStaffRole(accessRole)) {
    await sendTelegram(chatId, t.chatReplyForbidden(), await withMainMenuForChat(lang, chatId))
    return true
  }

  if (!userParticipatesInConversation(profile.id, conversation)) {
    await sendTelegram(chatId, t.chatReplyForbidden(), await withMainMenuForChat(lang, chatId))
    return true
  }

  if (!canWriteConversation(profile.id, accessRole, conversation)) {
    await sendTelegram(chatId, t.chatReplyForbidden(), await withMainMenuForChat(lang, chatId))
    return true
  }

  const senderName =
    [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() ||
    profile.email ||
    'User'

  const messageId = `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const now = new Date().toISOString()

  const messageData = {
    id: messageId,
    conversation_id: target.conversation_id,
    sender_id: profile.id,
    sender_role: accessRole,
    sender_name: senderName,
    message: text,
    content: text,
    type: 'text',
    metadata: { source: 'TELEGRAM_REPLY' },
    is_read: false,
    created_at: now,
  }

  const msgRes = await fetch(`${supabaseUrl}/rest/v1/messages`, {
    method: 'POST',
    headers: hdr(serviceKey),
    body: JSON.stringify(messageData),
  })

  if (!msgRes.ok) {
    const err = await msgRes.text().catch(() => '')
    console.error('[TELEGRAM CHAT REPLY] insert failed', err.slice(0, 300))
    await sendTelegram(chatId, t.chatReplyFailed(), await withMainMenuForChat(lang, chatId))
    return true
  }

  await fetch(`${supabaseUrl}/rest/v1/conversations?id=eq.${encodeURIComponent(target.conversation_id)}`, {
    method: 'PATCH',
    headers: hdr(serviceKey),
    body: JSON.stringify({ updated_at: now, last_message_at: now }),
  }).catch(() => {})

  const inboxUrl = buildLocalizedSiteUrl(lang, `/messages/${target.conversation_id}`)
  await sendTelegram(chatId, t.chatReplySent(inboxUrl), await withMainMenuForChat(lang, chatId))

  return true
}
