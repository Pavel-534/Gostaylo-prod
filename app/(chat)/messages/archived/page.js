'use client'

/**
 * Архивные диалоги (/messages/archived) — только скрытые у пользователя (archived=only).
 * Chrome: ChatTopBar (MessagesViewportShell) — без legacy GS-header.
 */

import { useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { useI18n } from '@/contexts/i18n-context'
import { useConversationInbox } from '@/hooks/use-conversation-inbox'
import { ConversationList } from '@/components/chat/ConversationList'
import {
  INBOX_TAB_HOSTING,
  INBOX_TAB_TRAVELING,
} from '@/lib/chat-inbox-tabs'
import { setConversationArchivedClient } from '@/lib/chat/conversation-api-client'
import { cn } from '@/lib/utils'
import { MOBILE_FLAT_SHELL_CARD_CLASS } from '@/lib/ui/mobile-flat-canvas'

const HOSTING_ROLES = new Set(['PARTNER', 'ADMIN', 'MODERATOR'])

function useUnarchive({ language, inbox }) {
  const unarchiveConversation = useCallback(
    async (convId) => {
      if (!convId) return
      try {
        const { ok, error } = await setConversationArchivedClient(convId, false)
        if (!ok) {
          toast.error(error || (language === 'ru' ? 'Не удалось вернуть' : 'Could not restore'))
          return
        }
        toast.success(language === 'ru' ? 'Диалог снова в списке' : 'Restored to inbox')
        inbox.setConversations((prev) => prev.filter((c) => c.id !== convId))
      } catch {
        toast.error(language === 'ru' ? 'Ошибка сети' : 'Network error')
      }
    },
    [language, inbox],
  )

  return { unarchiveConversation }
}

export default function MessagesArchivedPage() {
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
    archivedOnly: true,
  })

  const inboxListHref = '/messages/'

  const { unarchiveConversation } = useUnarchive({ language, inbox })

  const handleInboxTabChange = useCallback(
    (next) => {
      inbox.setInboxTab(next)
    },
    [inbox],
  )

  const handleConversationSelect = useCallback(
    (id) => {
      router.push(`/messages/${encodeURIComponent(id)}/`)
    },
    [router],
  )

  const showGuestName = useMemo(
    () => inbox.inboxTab === INBOX_TAB_TRAVELING,
    [inbox.inboxTab],
  )

  const title = language === 'en' ? 'Archive' : 'Архив'
  const backLabel = language === 'en' ? 'All conversations' : 'Все диалоги'

  if (authLoading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto bg-brand-surface px-4 py-8 text-center">
        <p className="mb-4 text-slate-600">
          {language === 'en' ? 'Sign in to see your messages' : 'Войдите, чтобы видеть диалоги'}
        </p>
        <Button variant="brand" onClick={() => openLoginModal?.('login')}>
          {language === 'en' ? 'Sign in' : 'Войти'}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-brand-surface">
      <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col overflow-hidden max-sm:px-0 max-sm:py-0 sm:px-4 sm:py-2">
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
            onUnarchive={(id) => void unarchiveConversation(id)}
            headerActionHref={inboxListHref}
            headerActionLabel={backLabel}
            language={language}
            roleTabsVisible={showHostingTabs}
            favoritesFilterEnabled={false}
            catalogHref={null}
            title={title}
            className="min-h-0 flex-1"
          />
        </div>
      </div>
    </div>
  )
}
