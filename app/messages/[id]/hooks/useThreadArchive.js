'use client'

import { useCallback } from 'react'
import { toast } from 'sonner'
import { getUIText } from '@/lib/translations'

/**
 * Archive current or another conversation; syncs inbox list and navigates when needed.
 */
export function useThreadArchive({
  language,
  router,
  inbox,
  conversationId,
  inboxListHref = '/messages/',
  archivedListHref = '/messages/archived/',
}) {
  const archiveConversation = useCallback(
    async (convId) => {
      if (!convId) return
      try {
        const res = await fetch('/api/v2/chat/conversations/archive', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId: convId, archived: true }),
        })
        const json = await res.json()
        if (!res.ok || !json.success) {
          toast.error(json.error || getUIText('messengerThread_toastCouldNotArchive', language))
          return
        }
        toast.success(getUIText('messengerThread_toastChatHidden', language), {
          action: {
            label: getUIText('messengerThread_toastOpenArchive', language),
            onClick: () => router.push(archivedListHref),
          },
        })
        inbox.setConversations((prev) => prev.filter((c) => c.id !== convId))
        if (String(conversationId) === String(convId)) {
          const remaining = inbox.filteredConversations.filter((c) => c.id !== convId)
          if (remaining[0]) {
            router.push(`/messages/${remaining[0].id}/`)
          } else router.push(inboxListHref)
        }
      } catch {
        toast.error(getUIText('listingDetail_networkError', language))
      }
    },
    [language, router, inbox, conversationId, inboxListHref, archivedListHref],
  )

  return { archiveConversation }
}
