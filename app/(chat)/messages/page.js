'use client'

/**
 * Единый холл сообщений (/messages).
 * Переход в тред: /messages/[id].
 */

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessagesAuthGate } from '@/components/product/MessagesAuthGate'
import { GuestBookingFlowHint } from '@/components/product/GuestBookingFlowHint'
import { toast } from 'sonner'

import { useAuth } from '@/contexts/auth-context'
import { useI18n } from '@/contexts/i18n-context'
import { useConversationInbox } from '@/hooks/use-conversation-inbox'
import { ConversationList } from '@/components/chat/ConversationList'
import { useIsMobile } from '@/hooks/use-mobile'
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh'
import {
  INBOX_TAB_HOSTING,
  INBOX_TAB_TRAVELING,
} from '@/lib/chat-inbox-tabs'
import { getUIText } from '@/lib/translations'
import { setConversationArchivedClient } from '@/lib/chat/conversation-api-client'
import { cn } from '@/lib/utils'
import { MOBILE_FLAT_SHELL_CARD_CLASS } from '@/lib/ui/mobile-flat-canvas'

const HOSTING_ROLES = new Set(['PARTNER', 'ADMIN', 'MODERATOR'])

function useArchive({ language, router, inbox, archivedListHref }) {
  const archiveConversation = useCallback(
    async (convId) => {
      if (!convId) return
      try {
        const { ok, error } = await setConversationArchivedClient(convId, true)
        if (!ok) {
          toast.error(error || (language === 'ru' ? 'Не удалось скрыть' : 'Could not archive'))
          return
        }
        toast.success(language === 'ru' ? 'Диалог скрыт' : 'Archived', {
          action: {
            label: language === 'ru' ? 'Архив' : 'Archive',
            onClick: () => router.push(archivedListHref),
          },
        })
        inbox.setConversations((prev) => prev.filter((c) => c.id !== convId))
      } catch {
        toast.error(language === 'ru' ? 'Ошибка сети' : 'Network error')
      }
    },
    [language, router, inbox, archivedListHref]
  )

  return { archiveConversation }
}

export default function UnifiedMessagesHallPage() {
  const router = useRouter()
  const { language } = useI18n()
  const { user, loading: authLoading, openLoginModal } = useAuth()
  const showHostingTabs = useMemo(() => {
    const r = String(user?.role || '').toUpperCase()
    return HOSTING_ROLES.has(r)
  }, [user?.role])

  const defaultTab = showHostingTabs ? INBOX_TAB_HOSTING : INBOX_TAB_TRAVELING

  const inbox = useConversationInbox({
    userId: user?.id,
    defaultTab,
    enabled: !!user?.id,
  })

  const archivedListHref = '/messages/archived/'

  const { archiveConversation } = useArchive({
    language,
    router,
    inbox,
    archivedListHref,
  })

  const handleInboxTabChange = useCallback(
    (next) => {
      inbox.setInboxTab(next)
    },
    [inbox]
  )

  const handleConversationSelect = useCallback(
    (id) => {
      router.push(`/messages/${encodeURIComponent(id)}/`)
    },
    [router]
  )

  const showGuestName = useMemo(
    () => inbox.inboxTab === INBOX_TAB_TRAVELING,
    [inbox.inboxTab]
  )

  const [inboxScrollEl, setInboxScrollEl] = useState(null)
  const isMobile = useIsMobile()
  const handleInboxRefresh = useCallback(() => {
    inbox.refresh()
  }, [inbox])
  const { indicator: pullIndicator } = usePullToRefresh({
    onRefresh: handleInboxRefresh,
    scrollEl: inboxScrollEl,
    // Stage 200.68 — wait for scroller mount; never bind document/window fallback on hall.
    enabled: isMobile && Boolean(inboxScrollEl),
  })

  const flowT = (key) => getUIText(key, language)

  if (authLoading || !user) {
    return <MessagesAuthGate authLoading={authLoading} user={user} language={language} openLoginModal={openLoginModal} />
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-brand-surface">
      <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-2 overflow-hidden max-sm:px-0 max-sm:py-0 sm:px-4 sm:py-2">
        {!showHostingTabs ? (
          <GuestBookingFlowHint t={flowT} className="shrink-0 max-sm:px-3 max-sm:pt-2" />
        ) : null}
        <div
          className={cn(
            MOBILE_FLAT_SHELL_CARD_CLASS,
            'flex min-h-0 flex-1 flex-col overflow-hidden',
          )}
        >
          <ConversationList
            inbox={{ ...inbox, setInboxTab: handleInboxTabChange }}
            selectedId={null}
            onSelect={handleConversationSelect}
            showListingName={false}
            showGuestName={showGuestName}
            onArchive={(id) => void archiveConversation(id)}
            headerActionHref={archivedListHref}
            headerActionLabel={language === 'en' ? 'Archive' : 'Архив'}
            language={language}
            roleTabsVisible={showHostingTabs}
            catalogHref={null}
            className="min-h-0 flex-1"
            scrollContainerRef={setInboxScrollEl}
            pullIndicator={pullIndicator}
          />
        </div>
      </div>
    </div>
  )
}
