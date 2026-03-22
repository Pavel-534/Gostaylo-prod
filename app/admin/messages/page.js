'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  MessageSquare,
  Send,
  Loader2,
  Building2,
  User,
  Shield,
  Check,
  CheckCheck,
  AlertTriangle,
  Search,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import { toast } from 'sonner'
import { StickyChatHeader } from '@/components/sticky-chat-header'
import { useRealtimeMessages } from '@/hooks/use-realtime-chat'

function apiMessageToRow(m) {
  if (!m) return null
  return {
    id: m.id,
    conversation_id: m.conversationId,
    sender_id: m.senderId,
    sender_role: m.senderRole,
    sender_name: m.senderName,
    message: m.message ?? m.content,
    content: m.content ?? m.message,
    type: m.type,
    metadata: m.metadata,
    is_read: m.isRead,
    created_at: m.createdAt,
  }
}

export default function AdminMessagesPage() {
  const messagesEndRef = useRef(null)
  const [me, setMe] = useState(null)
  const [conversations, setConversations] = useState([])
  const [selectedConv, setSelectedConv] = useState(null)
  const [messages, setMessages] = useState([])
  const [listing, setListing] = useState(null)
  const [booking, setBooking] = useState(null)
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [authChecked, setAuthChecked] = useState(false)

  const conversationId = selectedConv?.id

  const handleRealtime = (newMsg) => {
    if (newMsg.sender_id !== me?.id) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev
        return [...prev, newMsg]
      })
    }
  }

  const { isConnected } = useRealtimeMessages(conversationId, handleRealtime)

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
  }, [me])

  useEffect(() => {
    if (selectedConv?.id) {
      loadMessages(selectedConv.id)
    }
  }, [selectedConv?.id])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  async function loadConversations() {
    setLoading(true)
    try {
      const res = await fetch('/api/v2/chat/conversations?enrich=1', { credentials: 'include' })
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setConversations(json.data)
      } else {
        setConversations([])
      }
    } catch (error) {
      console.error('Failed to load conversations:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadMessages(convId) {
    try {
      const convRes = await fetch(
        `/api/v2/chat/conversations?id=${encodeURIComponent(convId)}&enrich=1`,
        { credentials: 'include' }
      )
      const convJson = await convRes.json()
      const conv = convJson.data?.[0]
      if (conv) {
        setSelectedConv(conv)
        setListing(conv.listing || null)
        setBooking(conv.booking || null)
      }

      const msgRes = await fetch(
        `/api/v2/chat/messages?conversationId=${encodeURIComponent(convId)}`,
        { credentials: 'include' }
      )
      const msgJson = await msgRes.json()
      if (msgJson.success && Array.isArray(msgJson.data)) {
        setMessages(msgJson.data.map(apiMessageToRow).filter(Boolean))
      } else {
        setMessages([])
      }

      await fetch('/api/v2/chat/read', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: convId }),
      })
      loadConversations()
    } catch (error) {
      console.error('Failed to load messages:', error)
    }
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!newMessage.trim() || !selectedConv || !me) return

    setSending(true)
    try {
      const res = await fetch('/api/v2/chat/messages', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConv.id,
          content: newMessage.trim(),
          type: 'text',
        }),
      })
      const json = await res.json()
      if (res.ok && json.success && json.data) {
        const row = apiMessageToRow(json.data)
        if (row) setMessages((prev) => [...prev, row])
        setNewMessage('')
        loadConversations()
      } else {
        toast.error(json.error || 'Ошибка при отправке')
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      toast.error('Ошибка при отправке')
    } finally {
      setSending(false)
    }
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      conv.partnerName?.toLowerCase().includes(q) ||
      conv.renterName?.toLowerCase().includes(q) ||
      conv.listing?.title?.toLowerCase().includes(q)
    )
  })

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!me) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center px-4">
        <p className="text-slate-600 mb-2">Требуется вход администратора или модератора.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-4">
      <Card className="w-full lg:w-96 flex-shrink-0 flex flex-col">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-5 w-5 text-indigo-600" />
            Все диалоги
            {conversations.filter((c) => c.unreadCount > 0).length > 0 && (
              <Badge className="bg-red-500 ml-auto">
                {conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0)}
              </Badge>
            )}
          </CardTitle>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Поиск..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-0">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p>Нет сообщений</p>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = selectedConv?.id === conv.id

              return (
                <div
                  key={conv.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedConv(conv)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelectedConv(conv)
                    }
                  }}
                  className={`p-4 border-b cursor-pointer transition-colors ${
                    isActive ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex gap-3">
                    {conv.listing?.images?.[0] ? (
                      <img
                        src={conv.listing.images[0]}
                        alt=""
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-slate-200 flex items-center justify-center">
                        <User className="h-6 w-6 text-slate-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-semibold text-sm text-slate-900 truncate">
                          {conv.partnerName || conv.renterName || 'Пользователь'}
                        </p>
                        <div className="flex items-center gap-1 shrink-0">
                          {conv.isPriority ? (
                            <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0">Приоритет</Badge>
                          ) : null}
                          {conv.unreadCount > 0 && (
                            <Badge className="bg-red-500 text-white">{conv.unreadCount}</Badge>
                          )}
                        </div>
                      </div>
                      {conv.listing?.title && (
                        <p className="text-xs text-slate-600 truncate mb-1">{conv.listing.title}</p>
                      )}
                      <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                        {['rejection', 'REJECTION'].includes(conv.lastMessage?.type) && (
                          <AlertTriangle className="h-3 w-3 text-red-500" />
                        )}
                        {conv.lastMessage?.message || conv.lastMessage?.content || 'Новый диалог'}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {selectedConv ? (
          <>
            <StickyChatHeader
              listing={listing}
              booking={booking}
              isAdminView
              className="rounded-t-lg"
            >
              <span
                className={`flex items-center gap-1 text-xs ${isConnected ? 'text-green-600' : 'text-orange-500'}`}
              >
                {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {isConnected ? 'Live' : '…'}
              </span>
            </StickyChatHeader>

            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 min-h-0">
              {messages.map((msg) => {
                const role = (msg.sender_role || '').toUpperCase()
                const isOwn = role === 'ADMIN' || role === 'MODERATOR'
                const isRejection = ['rejection', 'REJECTION'].includes(
                  String(msg.type || '').toLowerCase()
                )

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <Avatar className="w-8 h-8 flex-shrink-0">
                      <AvatarFallback
                        className={isOwn ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200'}
                      >
                        {isOwn ? (
                          <Shield className="h-4 w-4" />
                        ) : (
                          msg.sender_name?.[0]?.toUpperCase() || 'U'
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-md`}>
                      {!isOwn && (
                        <span className="text-xs text-slate-500 mb-1">{msg.sender_name}</span>
                      )}
                      <div
                        className={`px-4 py-2 rounded-2xl ${
                          isRejection
                            ? 'bg-red-50 text-red-900 border border-red-200 rounded-tl-none'
                            : isOwn
                              ? 'bg-indigo-600 text-white rounded-tr-none'
                              : 'bg-white text-slate-900 rounded-tl-none shadow-sm'
                        }`}
                      >
                        {isRejection && (
                          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-red-200">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            <span className="font-semibold text-sm">Отклонение</span>
                          </div>
                        )}
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {msg.message ?? msg.content}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-xs text-slate-500">
                          {msg.created_at &&
                            formatDistanceToNow(new Date(msg.created_at), {
                              addSuffix: true,
                              locale: ru,
                            })}
                        </span>
                        {isOwn &&
                          (msg.is_read ? (
                            <CheckCheck className="h-3 w-3 text-blue-500" />
                          ) : (
                            <Check className="h-3 w-3 text-slate-400" />
                          ))}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </CardContent>

            <div className="p-4 border-t bg-white">
              <form onSubmit={sendMessage} className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Напишите сообщение от имени поддержки..."
                  className="flex-1"
                  disabled={sending}
                />
                <Button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center min-h-[240px]">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Выберите диалог</h3>
              <p className="text-slate-600">Список слева — все активные беседы платформы</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
