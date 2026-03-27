'use client'

/**
 * Единый холл сообщений (/messages).
 * Переход в тред: /messages/[id] (legacy-страницы кабинетов остаются до Этапа 4).
 */

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Home, Archive } from 'lucide-react'
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

const HOSTING_ROLES = new Set(['PARTNER', 'ADMIN', 'MODERATOR'])

function useCategories() {
  const [categories, setCategories] = useState([])
  useEffect(() => {
    fetch('/api/v2/categories')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.data)) setCategories(d.data)
      })
      .catch(() => {})
  }, [])
  return categories
}

function useArchive({ language, router, inbox, archivedListHref, userId }) {
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
    [language, router, inbox, archivedListHref, userId]
  )

  return { archiveConversation }
}

export default function UnifiedMessagesHallPage() {
  const router = useRouter()
  const { language } = useI18n()
  const { user, loading: authLoading, openLoginModal } = useAuth()
  const categories = useCategories()

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

  const archivedListHref = showHostingTabs
    ? '/partner/messages/archived'
    : '/renter/messages/archived'

  const { archiveConversation } = useArchive({
    language,
    router,
    inbox,
    archivedListHref,
    userId: user?.id,
  })

  const handleInboxTabChange = useCallback(
    (next) => {
      inbox.setInboxTab(next)
    },
    [inbox]
  )

  const handleConversationSelect = useCallback(
    (id) => {
      router.push(`/messages/${encodeURIComponent(id)}`)
    },
    [router]
  )

  const showGuestName = useMemo(
    () => inbox.inboxTab === INBOX_TAB_TRAVELING,
    [inbox.inboxTab]
  )

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="sticky top-0 z-10 border-b bg-white">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-teal-600">
                <span className="text-sm font-bold text-white">GS</span>
              </div>
              <span className="font-bold text-slate-900">Gostaylo</span>
            </Link>
          </div>
        </div>
        <div className="mx-auto max-w-md px-4 py-16 text-center">
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
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-10">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:py-4">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-teal-600">
              <span className="text-sm font-bold text-white">GS</span>
            </div>
            <span className="truncate font-bold text-slate-900">Gostaylo</span>
          </Link>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Button asChild variant="outline" size="sm" className="border-teal-200 text-teal-800">
              <Link href={archivedListHref}>
                <Archive className="mr-1.5 h-4 w-4" />
                {language === 'en' ? 'Archive' : 'Архив'}
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/">
                <Home className="mr-1.5 h-4 w-4" />
                {language === 'en' ? 'Home' : 'На главную'}
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-6">
        <h1 className="mb-4 text-2xl font-bold text-slate-900">
          {language === 'en' ? 'Messages' : 'Сообщения'}
        </h1>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="min-h-[min(70dvh,560px)] lg:min-h-[480px]">
            <ConversationList
              inbox={{ ...inbox, setInboxTab: handleInboxTabChange }}
              selectedId={null}
              onSelect={handleConversationSelect}
              categories={categories}
              showListingName={false}
              showGuestName={showGuestName}
              onArchive={(id) => void archiveConversation(id)}
              archivedHref={archivedListHref}
              language={language}
              roleTabsVisible={showHostingTabs}
              className="h-full max-h-[70dvh] lg:max-h-[560px]"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
