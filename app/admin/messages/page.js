'use client'

import { Suspense, useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Inbox, Activity, Headphones, Loader2 } from 'lucide-react'

import { ChatThreadChrome } from '@/components/chat/ChatThreadChrome'
import { AdminConversationSidebar } from '@/components/chat/AdminConversationSidebar'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'

function AdminMessagesHallContent() {
  const { language } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [me, setMe] = useState(null)
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [authChecked, setAuthChecked] = useState(false)
  const [chatStats, setChatStats] = useState(null)
  const [priorityOnly, setPriorityOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const t = useCallback((key) => getUIText(key, language), [language])

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/v2/chat/stats', { credentials: 'include' })
      const json = await res.json()
      if (json.success && json.data) setChatStats(json.data)
    } catch {
      /* ignore */
    }
  }, [])

  const loadConversations = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true)
      try {
        const res = await fetch('/api/v2/chat/conversations?enrich=1', { credentials: 'include' })
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
          setConversations(json.data)
        } else {
          setConversations([])
        }
        await loadStats()
      } catch (error) {
        console.error('Failed to load conversations:', error)
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [loadStats]
  )

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/v2/auth/me', { credentials: 'include' })
        const data = await res.json()
        if (!data.success || !data.user) {
          setMe(null)
        } else if (!['ADMIN', 'MODERATOR'].includes(data.user.role)) {
          setMe(null)
        } else {
          setMe(data.user)
        }
      } catch {
        setMe(null)
      } finally {
        setAuthChecked(true)
      }
    })()
  }, [])

  useEffect(() => {
    if (!me) return
    loadConversations()
  }, [me, loadConversations])

  const openFromUrl = searchParams.get('open')
  useEffect(() => {
    if (!openFromUrl || !me) return
    router.replace(`/admin/messages/${encodeURIComponent(openFromUrl)}`)
  }, [openFromUrl, me, router])

  const filteredConversations = useMemo(() => {
    return conversations
      .filter((conv) => {
        if (!searchQuery.trim()) return true
        const q = searchQuery.toLowerCase()
        return (
          conv.partnerName?.toLowerCase().includes(q) ||
          conv.renterName?.toLowerCase().includes(q) ||
          conv.listing?.title?.toLowerCase().includes(q)
        )
      })
      .filter((conv) => !priorityOnly || conv.isPriority)
  }, [conversations, searchQuery, priorityOnly])

  if (!authChecked) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!me) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <p className="mb-2 text-slate-600">
          {language === 'en' ? 'Admin or moderator sign-in required.' : 'Требуется вход администратора или модератора.'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="border-indigo-100 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-indigo-50 p-2">
              <Inbox className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('adminStatsTotalChats')}</p>
              <p className="text-2xl font-bold tabular-nums text-slate-900">{chatStats?.totalChats ?? '—'}</p>
              <p className="text-xs text-slate-600">{t('adminStatsTotalChatsHint')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-100 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-emerald-50 p-2">
              <Activity className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('adminStatsActiveToday')}</p>
              <p className="text-2xl font-bold tabular-nums text-slate-900">{chatStats?.activeToday ?? '—'}</p>
              <p className="text-xs text-slate-600">{t('adminStatsActiveTodayHint')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-100 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-amber-50 p-2">
              <Headphones className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('adminStatsSupportNeeded')}</p>
              <p className="text-2xl font-bold tabular-nums text-slate-900">{chatStats?.supportNeeded ?? '—'}</p>
              <p className="text-xs text-slate-600">{t('adminStatsSupportNeededHint')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={priorityOnly ? 'default' : 'outline'}
          size="sm"
          className={priorityOnly ? 'bg-amber-600 hover:bg-amber-700' : ''}
          onClick={() => setPriorityOnly((v) => !v)}
        >
          {t('adminPriorityFilter')}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <ChatThreadChrome
          hasTread={false}
          sidebarSlot={
            <AdminConversationSidebar
              conversations={filteredConversations}
              loading={loading}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              priorityOnly={priorityOnly}
              selectedConversationId={null}
              onSelectConversation={(id) => router.push(`/admin/messages/${id}`)}
              searchPlaceholder={t('adminConversationsSearchPlaceholder')}
              language={language}
            />
          }
          language={language}
          className="h-full min-h-0 bg-slate-50 lg:bg-white"
        />
      </div>
    </div>
  )
}

export default function AdminMessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      }
    >
      <AdminMessagesHallContent />
    </Suspense>
  )
}
