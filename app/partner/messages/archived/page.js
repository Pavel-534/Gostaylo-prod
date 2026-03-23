'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, MessageSquare, Archive, RotateCcw, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function PartnerMessagesArchivedPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const me = await fetch('/api/v2/auth/me', { credentials: 'include' }).then((r) => r.json())
        if (cancelled) return
        if (!me.success || !me.user) {
          setUser(null)
          setLoading(false)
          return
        }
        setUser(me.user)

        const res = await fetch('/api/v2/chat/conversations?enrich=1&archived=only', {
          credentials: 'include',
        })
        const data = await res.json()
        if (!cancelled && data.success && Array.isArray(data.data)) {
          setConversations(data.data)
        }
      } catch {
        if (!cancelled) toast.error('Не удалось загрузить архив')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function restoreConversation(e, convId) {
    e.stopPropagation()
    try {
      const res = await fetch('/api/v2/chat/conversations/archive', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: convId, archived: false }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Не удалось вернуть диалог')
        return
      }
      setConversations((prev) => prev.filter((c) => c.id !== convId))
      toast.success('Диалог снова в списке')
    } catch {
      toast.error('Ошибка сети')
    }
  }

  if (loading) {
    return (
      <div className="p-4 lg:p-8 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="p-4 lg:p-8">
        <div className="flex flex-col items-center justify-center h-96 text-center">
          <h3 className="text-xl font-semibold text-slate-900 mb-2">Требуется авторизация</h3>
          <Button asChild className="mt-4">
            <Link href="/partner/dashboard">В кабинет</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/partner/messages">
            <ArrowLeft className="h-4 w-4 mr-2" />
            К сообщениям
          </Link>
        </Button>
      </div>

      <div className="flex items-start gap-2 mb-4 text-slate-500 text-sm">
        <Archive className="h-4 w-4 shrink-0 mt-0.5" />
        <span>Архив только убирает диалог из вашего списка; история сохраняется</span>
      </div>

      {conversations.length === 0 ? (
        <Card className="p-12 text-center">
          <Archive className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Архив пуст</h3>
          <p className="text-slate-600 mb-6">Скрытые диалоги появятся здесь</p>
          <Button asChild variant="outline" className="border-teal-200">
            <Link href="/partner/messages">К сообщениям</Link>
          </Button>
        </Card>
      ) : (
        <>
          <h1 className="text-2xl font-bold text-slate-900 mb-6">Архив диалогов</h1>
          <div className="space-y-4">
            {conversations.map((conv) => (
              <Card
                key={conv.id}
                className="p-4 cursor-pointer hover:shadow-md transition-shadow border-slate-200"
                onClick={() => router.push(`/partner/messages/${conv.id}`)}
              >
                <div className="flex gap-3 sm:gap-4 min-w-0">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden">
                    {conv.listing?.images?.[0] ? (
                      <img
                        src={conv.listing.images[0]}
                        alt=""
                        className="w-full h-full object-cover opacity-90"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <MessageSquare className="h-8 w-8 text-slate-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <p className="font-semibold text-slate-900">{conv.renterName || 'Клиент'}</p>
                        {conv.listing?.title ? (
                          <p className="text-sm text-slate-600 line-clamp-2">{conv.listing.title}</p>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 border-teal-200 text-teal-800"
                        title="Вернуть в список"
                        onClick={(e) => restoreConversation(e, conv.id)}
                      >
                        <RotateCcw className="h-4 w-4 sm:mr-1" />
                        <span className="hidden sm:inline">Вернуть</span>
                      </Button>
                    </div>
                    <p className="text-sm text-slate-500 line-clamp-2">
                      {conv.lastMessage?.message || conv.lastMessage?.content || 'Нет сообщений'}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
