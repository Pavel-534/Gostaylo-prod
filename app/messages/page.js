'use client'

/**
 * Единый холл сообщений (/messages).
 * Переход в тред: /messages/[id].
 */

import { useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Home, Search } from 'lucide-react'
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
import { getSiteDisplayName } from '@/lib/site-url'

const HOSTING_ROLES = new Set(['PARTNER', 'ADMIN', 'MODERATOR'])

function useArchive({ language, router, inbox, archivedListHref }) {
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
          toast.error(json.error || (language === 'ru' ? 'Не удалось скрыть' : 'Could not archive'))
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

  if (authLoading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-slate-50">
        <header className="shrink-0 border-b bg-white">
          <div className="mx-auto flex max-w-4xl items-center px-3 py-2">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-teal-600">
                <span className="text-sm font-bold text-white">GS</span>
              </div>
              <span className="font-bold text-slate-900">{getSiteDisplayName()}</span>
            </Link>
          </div>
        </header>
        <div className="mx-auto flex max-w-md flex-1 flex-col justify-center px-4 py-8 text-center">
          <p className="mb-4 text-slate-600">
            {language === 'en' ? 'Sign in to see your messages' : 'Войдите, чтобы видеть диалоги'}
          </p>
          <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => openLoginModal?.('login')}>
            {language === 'en' ? 'Sign in' : 'Войти'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50">
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 px-3 py-2">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-teal-600">
              <span className="text-sm font-bold text-white">GS</span>
            </div>
            <span className="truncate font-bold text-slate-900">{getSiteDisplayName()}</span>
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/listings">
                <Search className="mr-1 h-4 w-4" />
                {language === 'en' ? 'Search' : 'Каталог'}
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/">
                <Home className="mr-1 h-4 w-4" />
                {language === 'en' ? 'Home' : 'Главная'}
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col overflow-hidden md:px-4 md:py-2">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white md:rounded-xl md:border md:border-slate-200 md:shadow-sm">
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
            className="min-h-0 flex-1"
          />
        </div>
      </div>
    </div>
  )
}
