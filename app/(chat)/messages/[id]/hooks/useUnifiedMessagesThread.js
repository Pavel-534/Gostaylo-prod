'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useConversationInbox } from '@/hooks/use-conversation-inbox'
import { useChatThreadMessages } from '@/hooks/use-chat-thread-messages'
import {
  INBOX_TAB_HOSTING,
  INBOX_TAB_TRAVELING,
  consumeRenterInboxTabPreference,
} from '@/lib/chat-inbox-tabs'

/**
 * Inbox list + active thread fetch/realtime bridge (Stage 109.3).
 */
export function useUnifiedMessagesThread({
  conversationId,
  user,
  language = 'ru',
  isPartnerAccount,
  viewerRoleForHook,
  markGlobalRead,
  onThreadNewMessage,
}) {
  const threadRealtimeBridgeRef = useRef({ onInsert: null, onUpdate: null })

  const inbox = useConversationInbox({
    userId: user?.id,
    defaultTab: isPartnerAccount ? INBOX_TAB_HOSTING : INBOX_TAB_TRAVELING,
    enabled: !!user?.id,
    activeConversationId: conversationId,
    onActiveMessageInsert: (raw) => threadRealtimeBridgeRef.current.onInsert?.(raw),
    onActiveMessageUpdate: (raw) => threadRealtimeBridgeRef.current.onUpdate?.(raw),
  })

  useEffect(() => {
    if (!user?.id || isPartnerAccount) return
    const p = consumeRenterInboxTabPreference()
    if (p) inbox.setInboxTab(p)
  }, [user?.id, isPartnerAccount, inbox.setInboxTab])

  const clearInboxUnreadForConv = useCallback(
    (cid) => {
      if (!cid) return
      inbox.setConversations((prev) =>
        prev.map((c) => (String(c.id) === String(cid) ? { ...c, unreadCount: 0 } : c)),
      )
    },
    [inbox.setConversations],
  )

  const thread = useChatThreadMessages({
    conversationId,
    userId: user?.id,
    language,
    viewerRole: viewerRoleForHook,
    deferThreadRealtime: Boolean(conversationId),
    externalIsConnected: inbox.isMessagesRealtimeConnected,
    onMarkRead: () => {
      if (conversationId) {
        markGlobalRead(conversationId)
        clearInboxUnreadForConv(conversationId)
      }
    },
    onNewMessage: () => {
      inbox.refresh()
      onThreadNewMessage?.()
    },
  })

  useEffect(() => {
    threadRealtimeBridgeRef.current = {
      onInsert: thread.handleRealtimeInsert,
      onUpdate: thread.handleRealtimeUpdate,
    }
  }, [thread.handleRealtimeInsert, thread.handleRealtimeUpdate])

  useEffect(() => {
    if (conversationId) {
      markGlobalRead(conversationId)
      clearInboxUnreadForConv(conversationId)
    }
  }, [conversationId, markGlobalRead, clearInboxUnreadForConv])

  const tabSyncedForConvRef = useRef(null)
  useEffect(() => {
    tabSyncedForConvRef.current = null
  }, [conversationId])
  useEffect(() => {
    if (!conversationId || !user?.id) return
    if (!thread.selectedConv?.id || String(thread.selectedConv.id) !== String(conversationId)) return
    if (tabSyncedForConvRef.current === conversationId) return
    tabSyncedForConvRef.current = conversationId
    const uid = String(user.id)
    const isHost =
      String(thread.selectedConv.partnerId) === uid || String(thread.selectedConv.ownerId) === uid
    inbox.setInboxTab(isHost ? INBOX_TAB_HOSTING : INBOX_TAB_TRAVELING)
  }, [
    conversationId,
    thread.selectedConv?.id,
    thread.selectedConv?.partnerId,
    thread.selectedConv?.ownerId,
    user?.id,
    inbox.setInboxTab,
  ])

  const isHosting = useMemo(() => {
    if (!thread.selectedConv?.id || !user?.id) return false
    const uid = String(user.id)
    return (
      String(thread.selectedConv.partnerId) === uid || String(thread.selectedConv.ownerId) === uid
    )
  }, [thread.selectedConv, user])

  const isTraveling = !isHosting

  const conversationForMapper = useMemo(() => {
    if (!thread.selectedConv) return null
    return {
      renterId: thread.selectedConv.renterId,
      renter_id: thread.selectedConv.renterId,
      partnerId: thread.selectedConv.partnerId,
      partner_id: thread.selectedConv.partnerId,
      ownerId: thread.selectedConv.ownerId,
      owner_id: thread.selectedConv.ownerId,
    }
  }, [thread.selectedConv])

  return {
    inbox,
    ...thread,
    clearInboxUnreadForConv,
    isHosting,
    isTraveling,
    conversationForMapper,
  }
}
