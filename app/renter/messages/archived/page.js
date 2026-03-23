'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Home, Archive, RotateCcw, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'

export default function RenterMessagesArchivedPage() {
  const router = useRouter()
  const { user, loading: authLoading, openLoginModal } = useAuth()
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user?.id) {
      setLoading(false)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/v2/chat/conversations?enrich=1&archived=only', {
          credentials: 'include',
        })
        const data = await res.json()
        if (!cancelled && data.success && Array.isArray(data.data)) {
          setConversations(data.data)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user?.id, authLoading])

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

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="bg-white border-b sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">GS</span>
              </div>
              <span className="font-bold text-slate-900">Gostaylo</span>
            </Link>
          </div>
        </div>
        <div className="container mx-auto px-4 py-16 max-w-md text-center">
          <p className="text-slate-600 mb-4">Войдите, чтобы видеть архив</p>
          <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => openLoginModal('login')}>
            Войти
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="text-slate-700">
              <Link href="/renter/messages">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Диалоги
              </Link>
            </Button>
            <Link href="/" className="flex items-center gap-2 ml-1">
              <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs">GS</span>
              </div>
            </Link>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <Home className="h-4 w-4 mr-2" />
              На главную
            </Link>
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-2 mb-2 text-slate-500 text-sm">
          <Archive className="h-4 w-4" />
          <span>Скрытые диалоги остаются в системе для поддержки и бронирований</span>
        </div>

        {conversations.length === 0 ? (
          <Card className="p-12">
            <div className="text-center">
              <Archive className="h-10 w-10 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Архив пуст</h3>
              <p className="text-slate-600 mb-6">Здесь появятся диалоги, которые вы скроете из основного списка</p>
              <Button asChild variant="outline" className="border-teal-200 text-teal-800">
                <Link href="/renter/messages">К активным диалогам</Link>
              </Button>
            </div>
          </Card>
        ) : (
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-6">Архив диалогов</h1>
            <div className="space-y-4">
              {conversations.map((conv) => (
                <Card
                  key={conv.id}
                  className="p-4 cursor-pointer hover:shadow-lg transition-shadow border-slate-200"
                  onClick={() => router.push(`/renter/messages/${conv.id}`)}
                >
                  <div className="flex gap-3 sm:gap-4 min-w-0">
                    <img
                      src={conv.listing?.images?.[0] || '/placeholder.svg'}
                      alt={conv.listing?.title}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover flex-shrink-0 opacity-90"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-semibold text-slate-900 line-clamp-2 leading-snug">
                          {conv.listing?.title || 'Диалог'}
                        </h3>
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
                      <p className="text-sm text-slate-600 mb-1 truncate">{conv.listing?.district}</p>
                      <p className="text-sm text-slate-500 line-clamp-2 break-words">
                        {conv.lastMessage?.message ||
                          conv.lastMessage?.content ||
                          'Нет сообщений'}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
