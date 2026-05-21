/**
 * Stage 108.5 / 110.6 — общая логика merge Realtime для инбокса (ChatContext + useConversationInbox).
 */

import { routeInboxMessageToActiveThread } from '@/lib/chat/thread-inbox-bridge'

export function rawMsgToLastMessage(raw) {
  return {
    id: raw.id,
    content: raw.content ?? raw.message,
    message: raw.message ?? raw.content,
    type: raw.type,
    createdAt: raw.created_at,
    created_at: raw.created_at,
  }
}

/**
 * @param {object} conv
 * @param {object} msg — payload.new
 * @param {string} uid
 */
export function mergeMessageInsertIntoConversation(conv, msg, uid) {
  const isFromMe = String(msg.sender_id) === String(uid)
  const iAmRenter = String(conv.renterId) === String(uid)
  const iAmPartner = String(conv.partnerId) === String(uid)
  const wasArchivedByMe =
    (!isFromMe && iAmRenter && conv.renterArchivedAt) ||
    (!isFromMe && iAmPartner && conv.partnerArchivedAt)

  return {
    updated: {
      ...conv,
      lastMessage: rawMsgToLastMessage(msg),
      lastMessageAt: msg.created_at,
      unreadCount: isFromMe
        ? Number(conv.unreadCount) || 0
        : (Number(conv.unreadCount) || 0) + 1,
      renterArchivedAt: !isFromMe && iAmRenter ? null : conv.renterArchivedAt,
      partnerArchivedAt: !isFromMe && iAmPartner ? null : conv.partnerArchivedAt,
    },
    wasArchivedByMe,
    isFromMe,
  }
}

/**
 * @param {object} mapped
 * @param {object} raw
 */
export function mergeRawConvUpdate(mapped, raw) {
  return {
    ...mapped,
    statusLabel: raw.status_label ?? raw.status ?? mapped.statusLabel,
    lastMessageAt: raw.last_message_at ?? mapped.lastMessageAt,
    updatedAt: raw.updated_at ?? mapped.updatedAt,
    isPriority: raw.is_priority === true,
    renterArchivedAt: raw.renter_archived_at ?? null,
    partnerArchivedAt: raw.partner_archived_at ?? null,
    partnerName: raw.partner_name ?? mapped.partnerName,
    renterName: raw.renter_name ?? mapped.renterName,
  }
}

/**
 * INSERT в `messages` → превью списка + опционально активный тред (один канал на /messages*).
 *
 * @param {object} msg — payload.new
 * @param {{
 *   userId: string,
 *   setConversations: Function,
 *   unarchiveConversation?: (convId: string) => void,
 *   fetchOneConversation?: (convId: string) => Promise<void>,
 *   msgUnknownConvFetchRef?: { current: Set<string> },
 *   shouldPlayIncomingSound?: (convId: string) => boolean,
 *   playSound?: () => void,
 *   activeConversationId?: string | null,
 *   onActiveMessageInsert?: ((raw: object) => void) | null,
 * }} ctx
 */
export function handleInboxMessageInsert(msg, ctx) {
  const convId = msg?.conversation_id
  const convKey = String(convId || '')
  const uid = ctx.userId
  if (!convKey || !uid) return

  routeInboxMessageToActiveThread(msg, ctx.activeConversationId ?? null, {
    onInsert: ctx.onActiveMessageInsert ?? undefined,
  }, 'INSERT')

  let missingInList = false
  ctx.setConversations((prev) => {
    const idx = prev.findIndex((c) => String(c.id) === convKey)
    if (idx === -1) {
      missingInList = true
      return prev
    }

    const conv = prev[idx]
    const { updated, wasArchivedByMe, isFromMe } = mergeMessageInsertIntoConversation(conv, msg, uid)

    if (wasArchivedByMe && ctx.unarchiveConversation) {
      ctx.unarchiveConversation(convKey)
    }

    if (!isFromMe && ctx.shouldPlayIncomingSound?.(convId) && ctx.playSound) {
      ctx.playSound()
    }

    const next = prev.filter((c) => String(c.id) !== convKey)
    return [updated, ...next]
  })

  const fetchRef = ctx.msgUnknownConvFetchRef
  if (
    missingInList &&
    fetchRef &&
    ctx.fetchOneConversation &&
    !fetchRef.current.has(convKey)
  ) {
    fetchRef.current.add(convKey)
    void ctx.fetchOneConversation(convKey).finally(() => {
      fetchRef.current.delete(convKey)
    })
  }
}
