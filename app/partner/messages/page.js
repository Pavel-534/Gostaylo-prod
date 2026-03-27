'use client'

/**
 * Список диалогов партнёра (/partner/messages).
 *
 * Раньше здесь был только редирект на первый тред — из-за этого «Назад» в открытом чате
 * (router → /partner/messages → снова replace на тот же тред) ощущался бесконечным циклом.
 * Теперь, как у рентора, показываем реальный список; переход в тред — /partner/messages/[id].
 */

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { useI18n } from '@/contexts/i18n-context'
import { useConversationInbox } from '@/hooks/use-conversation-inbox'
import { ConversationList } from '@/components/chat/ConversationList'
import {
  INBOX_TAB_HOSTING,
  INBOX_TAB_TRAVELING,
} from '@/lib/chat-inbox-tabs'
import { conversationMessagesHref } from '@/components/chat/conversation-messages-href'

function usePartnerAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch('/api/v2/auth/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.user) setUser(d.user)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])
  return { user, loading }
}

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

function useArchive({ language, router, inbox, basePath, userId }) {
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
            onClick: () => router.push(`${basePath}/archived`),
          },
        })
        inbox.setConversations((prev) => prev.filter((c) => c.id !== convId))
      } catch {
        toast.error(language === 'ru' ? 'Ошибка сети' : 'Network error')
      }
    },
    [language, router, inbox, basePath, userId]
  )

  return { archiveConversation }
}

export default function PartnerMessagesIndex() {
  const router = useRouter()
  const { language } = useI18n()
  const { user, loading: authLoading } = usePartnerAuth()
  const categories = useCategories()

  const inbox = useConversationInbox({
    userId: user?.id,
    defaultTab: INBOX_TAB_HOSTING,
    enabled: !!user?.id,
  })

  const { archiveConversation } = useArchive({
    language,
    router,
    inbox,
    basePath: '/partner/messages',
    userId: user?.id,
  })

  const handleInboxTabChange = useCallback(
    (next) => {
      inbox.setInboxTab(next)
    },
    [inbox]
  )

  const handleConversationSelect = useCallback(
    (id, conv) => {
      const row =
        conv ||
        inbox.filteredConversations.find((c) => c.id === id) ||
        inbox.conversations.find((c) => c.id === id)
      const href = conversationMessagesHref(user?.id, row || { id }) || `/partner/messages/${id}`
      router.push(href)
    },
    [router, user?.id, inbox.filteredConversations, inbox.conversations]
  )

  const showGuestName = useMemo(
    () => inbox.inboxTab === INBOX_TAB_TRAVELING,
    [inbox.inboxTab]
  )

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="p-4 lg:p-8">
        <div className="flex flex-col items-center justify-center h-96 text-center">
          <h3 className="text-xl font-semibold text-slate-900 mb-2">Требуется авторизация</h3>
          <p className="text-slate-600">Войдите в систему для просмотра сообщений</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 w-full max-w-full flex-1 flex-col">
      <div className="min-h-[calc(100dvh-12rem)] lg:min-h-[calc(100vh-10rem)]">
        <ConversationList
          inbox={{ ...inbox, setInboxTab: handleInboxTabChange }}
          selectedId={null}
          onSelect={handleConversationSelect}
          categories={categories}
          showListingName={false}
          showGuestName={showGuestName}
          onArchive={(id) => void archiveConversation(id)}
          archivedHref="/partner/messages/archived"
          language={language}
          className="h-full max-h-[calc(100dvh-12rem)]"
        />
      </div>
    </div>
  )
}
