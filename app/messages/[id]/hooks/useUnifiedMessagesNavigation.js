'use client'

import { useCallback } from 'react'
import { INBOX_TAB_HOSTING } from '@/lib/chat-inbox-tabs'

/**
 * Inbox tab + conversation routing (Stage 109.3).
 */
export function useUnifiedMessagesNavigation({ router, inbox, conversationId, user }) {
  const handleInboxTabChange = useCallback(
    (next) => {
      inbox.setInboxTab(next)
      const list = inbox.conversations.filter((c) =>
        next === INBOX_TAB_HOSTING
          ? String(c.partnerId) === String(user?.id)
          : String(c.renterId) === String(user?.id),
      )
      if (conversationId && !list.some((c) => c.id === conversationId)) {
        if (list[0]) {
          router.push(`/messages/${list[0].id}/`)
        } else router.push('/messages/')
      }
    },
    [inbox, conversationId, router, user?.id],
  )

  const handleConversationSelect = useCallback(
    (id) => {
      router.push(`/messages/${id}/`)
    },
    [router],
  )

  return { handleInboxTabChange, handleConversationSelect }
}
