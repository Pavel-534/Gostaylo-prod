'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, MessageCircle, Home } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function RenterMessagesIndex() {
  const router = useRouter()
  const [renterId, setRenterId] = useState(null)
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedUser = localStorage.getItem('gostaylo_user')
    if (!storedUser) {
      setLoading(false)
      return
    }

    try {
      const user = JSON.parse(storedUser)
      setRenterId(user?.id || null)
    } catch {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!renterId) return

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/conversations?userId=${renterId}&role=RENTER`)
        const data = await res.json()
        if (!cancelled) setConversations(data?.data || [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [renterId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    )
  }

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
          <Button asChild variant="ghost">
            <Link href="/">
              <Home className="h-4 w-4 mr-2" />
              На главную
            </Link>
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {conversations.length === 0 ? (
          <Card className="p-12">
            <div className="text-center">
              <MessageCircle className="h-10 w-10 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Нет активных диалогов</h3>
              <p className="text-slate-600 mb-6">
                Когда вы отправите запрос на бронирование, диалог появится здесь
              </p>
              <Button asChild className="bg-teal-600 hover:bg-teal-700">
                <Link href="/listings">Найти жильё</Link>
              </Button>
            </div>
          </Card>
        ) : (
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-6">Мои диалоги</h1>
            <div className="space-y-4">
              {conversations.map((conv) => {
                const unread = conv.unreadCountRenter || 0
                return (
                  <Card
                    key={conv.id}
                    className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => router.push(`/renter/messages/${conv.id}`)}
                  >
                    <div className="flex gap-4">
                      <img
                        src={conv.listing?.images?.[0] || '/placeholder.svg'}
                        alt={conv.listing?.title}
                        className="w-20 h-20 rounded-lg object-cover"
                      />
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-slate-900">{conv.listing?.title}</h3>
                          {unread > 0 && (
                            <Badge className="bg-red-500 text-white ml-2">{unread} новых</Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 mb-2">{conv.listing?.district}</p>
                        <p className="text-sm text-slate-500 truncate">
                          {conv.lastMessage?.message || 'Новое сообщение'}
                        </p>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

