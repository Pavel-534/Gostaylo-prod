'use client'

import { Fragment, useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  MessageSquare,
  Send,
  Loader2,
  User,
  Shield,
  AlertTriangle,
  Search,
  Wifi,
  WifiOff,
  Paperclip,
  Inbox,
  Activity,
  Headphones,
} from 'lucide-react'
import { toast } from 'sonner'
import { StickyChatHeader } from '@/components/sticky-chat-header'
import { MessageBubble } from '@/components/message-bubble'
import { ChatTypingBar } from '@/components/chat-typing-bar'
import { ChatDateSeparator } from '@/components/chat-date-separator'
import { InvoiceBubble } from '@/components/invoice-bubble'
import { useI18n } from '@/contexts/i18n-context'
import { chatDayLabel, chatNeedsDaySeparator } from '@/lib/chat-date-labels'
import { BookingRequestCard, SystemMessage } from '@/components/booking-request-card'
import { uploadChatFile } from '@/lib/chat-upload'
import { useRealtimeMessages, usePresence } from '@/hooks/use-realtime-chat'
import { useMarkConversationRead } from '@/hooks/use-mark-conversation-read'
import { useChatTyping } from '@/hooks/use-chat-typing'

function apiMessageToRow(m) {
  if (!m) return null
  return {
    id: m.id,
    conversation_id: m.conversationId ?? m.conversation_id,
    sender_id: m.senderId ?? m.sender_id,
    sender_role: m.senderRole ?? m.sender_role,
    sender_name: m.senderName ?? m.sender_name,
    message: m.message ?? m.content,
    content: m.content ?? m.message,
    type: m.type,
    metadata: m.metadata,
    is_read: m.isRead ?? m.is_read,
    created_at: m.createdAt ?? m.created_at,
  }
}

export default function AdminMessagesPage() {
  const { language } = useI18n()
  const messagesEndRef = useRef(null)
  const attachFileRef = useRef(null)
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
  const [chatStats, setChatStats] = useState(null)
  const [priorityOnly, setPriorityOnly] = useState(false)

  const conversationId = selectedConv?.id

  const handleRealtime = useCallback(
    (newMsg) => {
      const sid = newMsg.sender_id ?? newMsg.senderId
      if (sid !== me?.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev
          const row = apiMessageToRow(newMsg)
          return row ? [...prev, row] : prev
        })
      }
    },
    [me?.id]
  )

  const handleMessageUpdate = useCallback((row) => {
    const normalized = {
      is_read: row.is_read,
      message: row.message,
      content: row.content,
      metadata: row.metadata,
      type: row.type,
    }
    setMessages((prev) =>
      prev.map((m) => (m.id === row.id ? { ...m, ...normalized } : m))
    )
  }, [])

  const { isConnected } = useRealtimeMessages(
    conversationId,
    handleRealtime,
    handleMessageUpdate
  )

  const { isOnline: peerOnline } = usePresence(conversationId, me?.id, null)

  useMarkConversationRead(conversationId, !!(conversationId && me?.id), peerOnline)

  const staffTypingName = useMemo(() => {
    if (!me) return 'Поддержка'
    const n = [me.first_name, me.last_name].filter(Boolean).join(' ').trim()
    return n || me.name || me.email || 'Поддержка'
  }, [me])

  const { peerTypingName, broadcastTyping } = useChatTyping(
    conversationId,
    me?.id,
    staffTypingName
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
  }, [me])

  useEffect(() => {
    if (selectedConv?.id) {
      loadMessages(selectedConv.id)
    }
  }, [selectedConv?.id])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  async function loadStats() {
    try {
      const res = await fetch('/api/v2/chat/stats', { credentials: 'include' })
      const json = await res.json()
      if (json.success && json.data) setChatStats(json.data)
    } catch {
      /* ignore */
    }
  }

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
      await loadStats()
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

  async function handleAttachFile(file) {
    if (!selectedConv || !me) return
    setSending(true)
    try {
      const { url } = await uploadChatFile(file, me.id)
      const isImg = file.type.startsWith('image/')
      const res = await fetch('/api/v2/chat/messages', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConv.id,
          type: isImg ? 'image' : 'file',
          metadata: isImg ? { url } : { file_url: url, file_name: file.name },
          skipPush: !!peerOnline,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Ошибка отправки')
        return
      }
      const row = apiMessageToRow(json.data)
      if (row) setMessages((prev) => [...prev, row])
      loadConversations()
      scrollToBottom()
    } catch (error) {
      toast.error(error?.message || 'Не удалось загрузить файл')
    } finally {
      setSending(false)
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
          skipPush: !!peerOnline,
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

  const filteredConversations = conversations
    .filter((conv) => {
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      return (
        conv.partnerName?.toLowerCase().includes(q) ||
        conv.renterName?.toLowerCase().includes(q) ||
        conv.listing?.title?.toLowerCase().includes(q)
      )
    })
    .filter((conv) => !priorityOnly || conv.isPriority)

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

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-indigo-100 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-indigo-50 p-2">
              <Inbox className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Chats</p>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">
                {chatStats?.totalChats ?? '—'}
              </p>
              <p className="text-xs text-slate-600">Всего диалогов</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-100 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-emerald-50 p-2">
              <Activity className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Active Today</p>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">
                {chatStats?.activeToday ?? '—'}
              </p>
              <p className="text-xs text-slate-600">Сообщения за 24 ч</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-100 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-amber-50 p-2">
              <Headphones className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Support Needed</p>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">
                {chatStats?.supportNeeded ?? '—'}
              </p>
              <p className="text-xs text-slate-600">Приоритетные диалоги</p>
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
          Показать только приоритетные
        </Button>
      </div>

      <div className="h-[calc(100vh-14rem)] min-h-[320px] flex flex-col lg:flex-row gap-4">
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
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
          ) : filteredConversations.length === 0 ? (
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

            <ChatTypingBar name={peerTypingName} />

            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 min-h-0">
              {messages.map((msg, idx) => {
                const prev = messages[idx - 1]
                const showDay = chatNeedsDaySeparator(prev?.created_at, msg.created_at)
                const dayLabel = chatDayLabel(msg.created_at, language)

                const role = (msg.sender_role || '').toUpperCase()
                const isOwn = role === 'ADMIN' || role === 'MODERATOR'
                const msgType = (msg.type || '').toLowerCase()
                const rawType = String(msg.type || '').toUpperCase()
                const isRejection = msgType === 'rejection'
                const isInvoice =
                  msgType === 'invoice' || msg.type === 'INVOICE' || msg.metadata?.invoice

                if (rawType === 'BOOKING_REQUEST') {
                  const bid = msg.metadata?.booking_id || msg.bookingId
                  return (
                    <Fragment key={msg.id}>
                      {showDay ? <ChatDateSeparator label={dayLabel} /> : null}
                      <BookingRequestCard
                        message={{
                          ...msg,
                          conversationId: msg.conversation_id,
                          bookingId: bid,
                        }}
                        userRole="ADMIN"
                        bookingStatus={booking?.status}
                      />
                    </Fragment>
                  )
                }

                if (msgType === 'system') {
                  const sk = msg.metadata?.system_key
                  let line = null
                  if (sk === 'passport_request') line = 'Системное сообщение'
                  if (sk === 'booking_confirmed' || sk === 'booking_declined') line = 'Бронирование'
                  return (
                    <Fragment key={msg.id}>
                      {showDay ? <ChatDateSeparator label={dayLabel} /> : null}
                      <div className="flex justify-center px-2">
                        <div className="max-w-lg rounded-xl bg-slate-100 border border-slate-200 px-4 py-2 text-sm text-slate-700 text-center">
                          {line ? <p className="text-xs font-semibold text-indigo-800 mb-1">{line}</p> : null}
                          {msg.message ?? msg.content}
                        </div>
                      </div>
                    </Fragment>
                  )
                }

                if (role === 'SYSTEM') {
                  return (
                    <Fragment key={msg.id}>
                      {showDay ? <ChatDateSeparator label={dayLabel} /> : null}
                      <SystemMessage message={msg} />
                    </Fragment>
                  )
                }

                if (isInvoice && msg.metadata?.invoice) {
                  return (
                    <Fragment key={msg.id}>
                      {showDay ? <ChatDateSeparator label={dayLabel} /> : null}
                      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        <InvoiceBubble
                          invoice={msg.metadata.invoice}
                          isOwn={isOwn}
                          showPay={false}
                          paymentMethod={msg.metadata.invoice.payment_method}
                        />
                      </div>
                    </Fragment>
                  )
                }

                const isPartner = role === 'PARTNER'
                const isStaffIncoming = role === 'ADMIN' || role === 'MODERATOR'
                const isBubble =
                  ['text', 'image', 'file', 'rejection', ''].includes(msgType) || !msg.type

                if (!isBubble) return null

                return (
                  <Fragment key={msg.id}>
                    {showDay ? <ChatDateSeparator label={dayLabel} /> : null}
                    <MessageBubble
                      msg={msg}
                      isOwn={isOwn}
                      isAdmin={isStaffIncoming && !isOwn}
                      isRejection={isRejection}
                      ownVariant="indigo"
                      showSenderName={!isOwn}
                      senderName={msg.sender_name || 'Участник'}
                      translateTargetLang={language}
                      translateButtonLabels={{
                        translate: language === 'ru' ? 'Перевести' : 'Translate',
                        original: language === 'ru' ? 'Оригинал' : 'Original',
                        translating: '…',
                      }}
                      avatarFallback={
                        isOwn ? (
                          <Shield className="h-4 w-4" />
                        ) : isStaffIncoming && !isPartner ? (
                          <Shield className="h-4 w-4" />
                        ) : (
                          msg.sender_name?.[0]?.toUpperCase() || 'U'
                        )
                      }
                    />
                  </Fragment>
                )
              })}
              <div ref={messagesEndRef} />
            </CardContent>

            <div className="p-4 border-t bg-white">
              <input
                ref={attachFileRef}
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (f) handleAttachFile(f)
                }}
              />
              <form onSubmit={sendMessage} className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="flex-shrink-0 border-slate-200"
                  disabled={sending}
                  aria-label="Прикрепить файл"
                  onClick={() => attachFileRef.current?.click()}
                >
                  <Paperclip className="h-5 w-5" />
                </Button>
                <Input
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value)
                    broadcastTyping()
                  }}
                  placeholder="Напишите сообщение от имени поддержки..."
                  className="flex-1 min-w-0"
                  disabled={sending}
                />
                <Button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className="bg-indigo-600 hover:bg-indigo-700 flex-shrink-0"
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
    </div>
  )
}
