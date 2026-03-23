'use client'

import { Fragment, useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Send,
  Loader2,
  ArrowLeft,
  Paperclip,
  Home,
  Wifi,
  WifiOff,
  Shield,
  Archive,
} from 'lucide-react'
import { StickyChatHeader } from '@/components/sticky-chat-header'
import { BookingRequestCard, SystemMessage } from '@/components/booking-request-card'
import { detectUnsafePatterns, SafetyBanner } from '@/components/chat-safety'
import { InvoiceBubble } from '@/components/invoice-bubble'
import { MessageBubble } from '@/components/message-bubble'
import { ChatDateSeparator } from '@/components/chat-date-separator'
import { uploadChatFile } from '@/lib/chat-upload'
import { useI18n } from '@/contexts/i18n-context'
import { chatDayLabel, chatNeedsDaySeparator } from '@/lib/chat-date-labels'
import { useRealtimeMessages, usePresence, playNotificationSound } from '@/hooks/use-realtime-chat'
import { useMarkConversationRead } from '@/hooks/use-mark-conversation-read'
import { useChatTyping } from '@/hooks/use-chat-typing'
import { toast } from 'sonner'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'

function apiMessageToRow(m) {
  if (!m) return null
  return {
    id: m.id,
    conversationId: m.conversationId,
    conversation_id: m.conversationId,
    senderId: m.senderId,
    sender_id: m.senderId,
    senderRole: m.senderRole,
    sender_role: m.senderRole,
    senderName: m.senderName,
    sender_name: m.senderName,
    message: m.message ?? m.content,
    content: m.content ?? m.message,
    type: m.type,
    metadata: m.metadata,
    isRead: m.isRead,
    is_read: m.isRead,
    createdAt: m.createdAt,
    created_at: m.createdAt,
    bookingId: m.metadata?.booking_id || m.metadata?.bookingId,
  }
}

export default function RenterMessages({ params }) {
  const router = useRouter()
  const { language } = useI18n()
  const { user, loading: authLoading, openLoginModal } = useAuth()
  const messagesEndRef = useRef(null)
  const attachFileRef = useRef(null)
  const [conversations, setConversations] = useState([])
  const [selectedConv, setSelectedConv] = useState(null)
  const [messages, setMessages] = useState([])
  const [listing, setListing] = useState(null)
  const [booking, setBooking] = useState(null)
  const [bookingStatus, setBookingStatus] = useState(null)
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [supportLoading, setSupportLoading] = useState(false)
  const [safetyWarningShown, setSafetyWarningShown] = useState(false)
  const [detectedPatterns, setDetectedPatterns] = useState([])

  const renterId = user?.id
  const conversationId = params?.id

  const handleNewRealtimeMessage = useCallback(
    (newMsg) => {
      if (newMsg.sender_id !== renterId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev
          return [...prev, newMsg]
        })
        playNotificationSound()
        toast.info('💬 Новое сообщение')
      }
    },
    [renterId]
  )

  const handleMessageUpdate = useCallback((row) => {
    setMessages((prev) => prev.map((m) => (m.id === row.id ? { ...m, ...row } : m)))
  }, [])

  const { isConnected } = useRealtimeMessages(
    conversationId,
    handleNewRealtimeMessage,
    handleMessageUpdate
  )
  const { isOnline: partnerOnline } = usePresence(
    conversationId,
    renterId,
    selectedConv?.partnerId || selectedConv?.adminId || null
  )

  useMarkConversationRead(conversationId, !!(conversationId && renterId), partnerOnline)

  const renterTypingName = useMemo(() => {
    if (!user) return 'Гость'
    if (user.name) return user.name
    const n = [user.first_name, user.last_name].filter(Boolean).join(' ').trim()
    return n || user.email || 'Гость'
  }, [user])

  const { peerTypingName, broadcastTyping } = useChatTyping(
    conversationId,
    renterId,
    renterTypingName
  )

  const headerTypingLine = useMemo(() => {
    if (!peerTypingName) return null
    return language === 'ru' ? `${peerTypingName} печатает…` : `${peerTypingName} is typing…`
  }, [peerTypingName, language])

  useEffect(() => {
    if (authLoading) return
    if (!renterId) {
      setLoading(false)
      return
    }
    loadConversations()
  }, [renterId, authLoading])

  useEffect(() => {
    if (conversationId && renterId) {
      loadMessages(conversationId)
    }
  }, [conversationId, renterId])

  useEffect(() => {
    if (!conversationId || typeof window === 'undefined') return
    try {
      const key = `gostaylo_chat_prefill_${conversationId}`
      const v = sessionStorage.getItem(key)
      if (v) {
        setNewMessage((prev) => (prev.trim() ? prev : v))
        sessionStorage.removeItem(key)
      }
    } catch {
      /* ignore */
    }
  }, [conversationId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (messages.length > 0) {
      const allPatterns = []
      messages.forEach((msg) => {
        const text = msg.message || msg.content || ''
        const result = detectUnsafePatterns(text)
        if (result.hasRisk) {
          allPatterns.push(...result.patterns)
        }
      })
      if (allPatterns.length > 0 && !safetyWarningShown) {
        setDetectedPatterns(allPatterns)
      }
    }
  }, [messages, safetyWarningShown])

  async function loadConversations() {
    if (!renterId) return
    try {
      const res = await fetch('/api/v2/chat/conversations?enrich=1', { credentials: 'include' })
      const data = await res.json()
      if (data.success && Array.isArray(data.data)) {
        setConversations(data.data)
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
      if (!conv) return

      setSelectedConv(conv)
      setListing(conv.listing || null)
      setBooking(conv.booking || null)

      const msgRes = await fetch(
        `/api/v2/chat/messages?conversationId=${encodeURIComponent(convId)}`,
        { credentials: 'include' }
      )
      const msgJson = await msgRes.json()
      if (msgJson.success && Array.isArray(msgJson.data)) {
        const rows = msgJson.data.map(apiMessageToRow).filter(Boolean)
        setMessages(rows)

        const bookingRequestMsg = rows.find((m) =>
          String(m.type || '').toUpperCase().includes('BOOKING')
        )
        const bid = bookingRequestMsg?.metadata?.booking_id || bookingRequestMsg?.bookingId
        if (bid) fetchBookingStatus(bid)
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

  async function handleRequestSupport() {
    if (!selectedConv?.id || supportLoading) return
    setSupportLoading(true)
    try {
      const res = await fetch('/api/v2/chat/escalate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selectedConv.id }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Не удалось отправить запрос')
        return
      }
      setSelectedConv((prev) => (prev ? { ...prev, isPriority: true } : prev))
      if (json.data?.notified) {
        toast.success('Запрос передан в поддержку')
      } else {
        toast.success('Диалог уже отмечен для поддержки')
      }
      loadConversations()
    } catch {
      toast.error('Ошибка сети')
    } finally {
      setSupportLoading(false)
    }
  }

  async function fetchBookingStatus(bookingId) {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/payment-status`)
      const data = await res.json()
      if (data.success && data.data?.booking) {
        setBookingStatus(data.data.booking.status)
      }
    } catch (error) {
      console.error('Failed to fetch booking status:', error)
    }
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!newMessage.trim() || !selectedConv || !renterId) return

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
          skipPush: !!partnerOnline,
        }),
      })
      const data = await res.json()
      if (data.success && data.data) {
        const row = apiMessageToRow(data.data)
        if (row) setMessages((prev) => [...prev, row])
        setNewMessage('')
        loadConversations()
      } else {
        toast.error(data.error || 'Ошибка при отправке')
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      toast.error('Ошибка при отправке сообщения')
    } finally {
      setSending(false)
    }
  }

  async function handleAttachFile(file) {
    if (!selectedConv || !renterId) return
    setSending(true)
    try {
      const { url } = await uploadChatFile(file, renterId)
      const isImg = file.type.startsWith('image/')
      const res = await fetch('/api/v2/chat/messages', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConv.id,
          type: isImg ? 'image' : 'file',
          metadata: isImg ? { url } : { file_url: url, file_name: file.name },
          skipPush: !!partnerOnline,
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

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  function handleBookingStatusUpdate() {
    setTimeout(() => {
      if (conversationId) loadMessages(conversationId)
      loadConversations()
    }, 500)
  }

  async function handleArchiveDialog() {
    if (!selectedConv?.id) return
    try {
      const res = await fetch('/api/v2/chat/conversations/archive', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selectedConv.id, archived: true }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Не удалось скрыть диалог')
        return
      }
      toast.success('Диалог скрыт из списка')
      router.push('/renter/messages')
    } catch {
      toast.error('Ошибка сети')
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
        <p className="text-slate-600 mb-4">Войдите, чтобы открыть сообщения</p>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => openLoginModal('login')}>
          Войти
        </Button>
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
        {conversations.length === 0 && !conversationId ? (
          <Card className="p-12">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Нет активных диалогов</h3>
              <p className="text-slate-600 mb-6">
                Когда вы отправите запрос на бронирование, диалог появится здесь
              </p>
              <Button asChild className="bg-teal-600 hover:bg-teal-700">
                <Link href="/">Найти жильё</Link>
              </Button>
            </div>
          </Card>
        ) : !conversationId ? (
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Мои диалоги</h2>
            <div className="space-y-4">
              {conversations.map((conv) => {
                const unread = conv.unreadCount ?? 0
                return (
                  <Card
                    key={conv.id}
                    className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => router.push(`/renter/messages/${conv.id}`)}
                  >
                    <div className="flex gap-3 sm:gap-4 min-w-0">
                      <img
                        src={conv.listing?.images?.[0] || '/placeholder.svg'}
                        alt={conv.listing?.title}
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="font-semibold text-slate-900 line-clamp-2 leading-snug">
                            {conv.listing?.title}
                          </h3>
                          {unread > 0 && (
                            <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full shrink-0">
                              {unread} новых
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 mb-1 truncate">{conv.listing?.district}</p>
                        <p className="text-sm text-slate-500 line-clamp-2 break-words">
                          {conv.lastMessage?.message || conv.lastMessage?.content || 'Новое сообщение'}
                        </p>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Button variant="ghost" onClick={() => router.push('/renter/messages')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Все диалоги
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-slate-600 border-slate-200"
                onClick={() => handleArchiveDialog()}
              >
                <Archive className="h-4 w-4 mr-1.5" />
                Скрыть из списка
              </Button>
            </div>

            <StickyChatHeader
              listing={listing}
              booking={booking}
              isAdminView={false}
              contactName={selectedConv?.partnerName || 'Партнёр'}
              presenceOnline={partnerOnline}
              typingIndicator={headerTypingLine}
              typingGateWithPresence
              onSupportClick={handleRequestSupport}
              supportLoading={supportLoading}
              supportPriorityActive={!!selectedConv?.isPriority}
              supportLabel="Помощь"
              supportDoneLabel="В поддержке"
            >
              <div className="flex flex-col items-end gap-1">
                <span
                  className={`flex items-center gap-1 text-xs ${isConnected ? 'text-green-600' : 'text-orange-500'}`}
                >
                  {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                  {isConnected ? 'Live' : '…'}
                </span>
              </div>
            </StickyChatHeader>

            {bookingStatus === 'PAID' &&
              String(listing?.category_id ?? listing?.categoryId) !== '2' && (
              <Card className="bg-gradient-to-r from-teal-50 to-blue-50 border-teal-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🏍️</span>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">Нужен транспорт?</p>
                      <p className="text-sm text-slate-600">
                        Исследуйте нашу коллекцию байков и автомобилей!
                      </p>
                    </div>
                    <Button asChild size="sm" className="bg-teal-600 hover:bg-teal-700">
                      <Link href="/?category=vehicles">Vehicles</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <SafetyBanner
              patterns={detectedPatterns}
              onDismiss={() => setSafetyWarningShown(true)}
              lang="ru"
            />

            <Card className="overflow-hidden">
              <div className="h-[500px] overflow-y-auto p-4 space-y-4">
                {messages.map((msg, idx) => {
                  const prev = messages[idx - 1]
                  const showDay = chatNeedsDaySeparator(prev?.created_at, msg.created_at)
                  const dayLabel = chatDayLabel(msg.created_at, language)

                  const rawType = String(msg.type || '').toUpperCase()
                  if (rawType === 'BOOKING_REQUEST') {
                    return (
                      <Fragment key={msg.id}>
                        {showDay ? <ChatDateSeparator label={dayLabel} /> : null}
                        <BookingRequestCard
                          message={msg}
                          userRole="RENTER"
                          onStatusUpdate={handleBookingStatusUpdate}
                        />
                      </Fragment>
                    )
                  }

                  if (String(msg.type || '').toLowerCase() === 'system') {
                    const sk = msg.metadata?.system_key
                    let line = null
                    if (sk === 'passport_request') line = 'Системное сообщение'
                    if (sk === 'booking_confirmed' || sk === 'booking_declined') line = 'Бронирование'
                    return (
                      <Fragment key={msg.id}>
                        {showDay ? <ChatDateSeparator label={dayLabel} /> : null}
                        <div className="flex justify-center px-2">
                          <div className="max-w-lg rounded-xl bg-slate-100 border border-slate-200 px-4 py-2 text-sm text-slate-700 text-center">
                            {line ? <p className="text-xs font-semibold text-teal-800 mb-1">{line}</p> : null}
                            {msg.message || msg.content}
                          </div>
                        </div>
                      </Fragment>
                    )
                  }

                  if ((msg.sender_role || msg.senderRole) === 'SYSTEM') {
                    return (
                      <Fragment key={msg.id}>
                        {showDay ? <ChatDateSeparator label={dayLabel} /> : null}
                        <SystemMessage message={msg} />
                      </Fragment>
                    )
                  }

                  const isInvoice =
                    String(msg.type || '').toLowerCase() === 'invoice' ||
                    msg.type === 'INVOICE' ||
                    msg.metadata?.invoice
                  if (isInvoice && msg.metadata?.invoice) {
                    const isOwn = msg.sender_id === renterId || msg.senderId === renterId
                    return (
                      <Fragment key={msg.id}>
                        {showDay ? <ChatDateSeparator label={dayLabel} /> : null}
                        <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                          <InvoiceBubble
                            invoice={msg.metadata.invoice}
                            isOwn={isOwn}
                            showPay={!isOwn}
                            paymentMethod={msg.metadata.invoice.payment_method}
                          />
                        </div>
                      </Fragment>
                    )
                  }

                  const isOwn = msg.sender_id === renterId || msg.senderId === renterId
                  const isPartner =
                    msg.sender_role === 'PARTNER' || msg.senderRole === 'PARTNER'
                  const isAdmin =
                    msg.sender_role === 'ADMIN' ||
                    msg.senderRole === 'ADMIN' ||
                    msg.sender_role === 'MODERATOR' ||
                    msg.senderRole === 'MODERATOR'
                  const mt = (msg.type || '').toLowerCase()
                  const isRejection = mt === 'rejection'

                  if (
                    ['text', 'image', 'file', 'rejection', ''].includes(mt) ||
                    !msg.type
                  ) {
                    return (
                      <Fragment key={msg.id}>
                        {showDay ? <ChatDateSeparator label={dayLabel} /> : null}
                        <MessageBubble
                          msg={msg}
                          isOwn={isOwn}
                          isAdmin={isAdmin && !isPartner}
                          isRejection={isRejection}
                          showSenderName={!isOwn}
                          senderName={msg.sender_name || msg.senderName || 'Участник'}
                          translateTargetLang={language}
                          translateButtonLabels={{
                            translate: language === 'ru' ? 'Перевести' : 'Translate',
                            original: language === 'ru' ? 'Оригинал' : 'Original',
                            translating: '…',
                          }}
                          avatarFallback={
                            isAdmin ? (
                              <Shield className="h-4 w-4" />
                            ) : isPartner ? (
                              (msg.sender_name || msg.senderName)?.[0]?.toUpperCase() || 'P'
                            ) : (
                              (msg.sender_name || msg.senderName)?.[0]?.toUpperCase() || 'U'
                            )
                          }
                        />
                      </Fragment>
                    )
                  }

                  return null
                })}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t p-4">
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
                    placeholder="Напишите сообщение..."
                    className="flex-1 min-w-0"
                    disabled={sending}
                  />
                  <Button
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                    className="bg-teal-600 hover:bg-teal-700 flex-shrink-0"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
