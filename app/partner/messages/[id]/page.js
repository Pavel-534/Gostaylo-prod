'use client'

import { Fragment, useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Loader2,
  ArrowLeft,
  AlertTriangle,
  MessageSquare,
  Shield,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  useRealtimeMessages,
  usePresence,
  playNotificationSound,
} from '@/hooks/use-realtime-chat'
import { useMarkConversationRead } from '@/hooks/use-mark-conversation-read'
import { useChatTyping } from '@/hooks/use-chat-typing'
import { ConversationList } from '@/components/conversation-list'
import { StickyChatHeader } from '@/components/sticky-chat-header'
import { PartnerChatComposer } from '@/components/partner-chat-composer'
import { InvoiceBubble } from '@/components/invoice-bubble'
import { MessageBubble } from '@/components/message-bubble'
import { ChatTypingBar } from '@/components/chat-typing-bar'
import { ChatDateSeparator } from '@/components/chat-date-separator'
import { uploadChatFile } from '@/lib/chat-upload'
import { useI18n } from '@/contexts/i18n-context'
import { chatDayLabel, chatNeedsDaySeparator } from '@/lib/chat-date-labels'

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

export default function PartnerMessages({ params }) {
  const router = useRouter()
  const { language } = useI18n()
  const messagesEndRef = useRef(null)
  const [user, setUser] = useState(null)
  const [conversations, setConversations] = useState([])
  const [categories, setCategories] = useState([])
  const [categoryFilter, setCategoryFilter] = useState(null)
  const [selectedConv, setSelectedConv] = useState(null)
  const [messages, setMessages] = useState([])
  const [listing, setListing] = useState(null)
  const [booking, setBooking] = useState(null)
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [supportLoading, setSupportLoading] = useState(false)
  const [bookingActionLoading, setBookingActionLoading] = useState(false)

  const conversationId = params?.id

  const handleNewRealtimeMessage = useCallback(
    (newMsg) => {
      if (newMsg.sender_id !== user?.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev
          return [...prev, newMsg]
        })
        playNotificationSound()
        toast.info('💬 Новое сообщение от гостя')
      }
    },
    [user]
  )

  const handleMessageUpdate = useCallback((row) => {
    setMessages((prev) => prev.map((m) => (m.id === row.id ? { ...m, ...row } : m)))
  }, [])

  const { isConnected } = useRealtimeMessages(
    conversationId,
    handleNewRealtimeMessage,
    handleMessageUpdate
  )
  const peerParticipantId =
    selectedConv?.adminId || selectedConv?.renterId || null
  const { isOnline: peerOnline } = usePresence(
    conversationId,
    user?.id,
    peerParticipantId
  )

  useMarkConversationRead(conversationId, !!(conversationId && user?.id), peerOnline)

  const partnerNameForTyping = useMemo(() => {
    if (!user) return 'Partner'
    if (user.name) return user.name
    const n = [user.first_name, user.last_name].filter(Boolean).join(' ').trim()
    return n || user.email || 'Partner'
  }, [user])

  const { peerTypingName, broadcastTyping } = useChatTyping(
    conversationId,
    user?.id,
    partnerNameForTyping
  )

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    fetch('/api/v2/categories')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.data)) setCategories(d.data)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (user) loadConversations()
  }, [user, categoryFilter])

  useEffect(() => {
    if (conversationId && user) {
      loadMessages(conversationId)
      markAsRead(conversationId)
    } else if (conversations.length > 0 && !conversationId) {
      router.push(`/partner/messages/${conversations[0].id}`)
    }
  }, [conversationId, conversations, user])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  async function checkAuth() {
    try {
      const res = await fetch('/api/v2/auth/me', { credentials: 'include' })
      const data = await res.json()
      if (data.success && data.user) {
        setUser(data.user)
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  async function loadConversations() {
    try {
      const params = new URLSearchParams({ enrich: '1' })
      if (categoryFilter) params.set('listing_category', categoryFilter)
      const res = await fetch(`/api/v2/chat/conversations?${params}`, { credentials: 'include' })
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setConversations(json.data)
      } else {
        setConversations([])
      }
    } catch (error) {
      console.error('Failed to load conversations:', error)
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
      if (!msgJson.success || !Array.isArray(msgJson.data)) {
        setMessages([])
        return
      }
      setMessages(msgJson.data.map(apiMessageToRow).filter(Boolean))
    } catch (error) {
      console.error('Failed to load messages:', error)
    }
  }

  async function postBookingSystemMessage(systemKey, content) {
    if (!selectedConv?.id) return
    const msgRes = await fetch('/api/v2/chat/messages', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: selectedConv.id,
        type: 'system',
        content,
        metadata: { system_key: systemKey },
        skipPush: !!peerOnline,
      }),
    })
    const msgJson = await msgRes.json()
    if (msgRes.ok && msgJson.success && msgJson.data) {
      const row = apiMessageToRow(msgJson.data)
      if (row) setMessages((prev) => [...prev, row])
    }
  }

  async function handleConfirmBookingHeader() {
    const bid = booking?.id
    if (!bid || !selectedConv?.id || bookingActionLoading) return
    setBookingActionLoading(true)
    try {
      const put = await fetch(`/api/v2/partner/bookings/${encodeURIComponent(bid)}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CONFIRMED' }),
      })
      const json = await put.json()
      if (json.status !== 'success') {
        toast.error(json.error || 'Ошибка')
        return
      }
      setBooking((b) => (b ? { ...b, status: 'CONFIRMED' } : b))
      await postBookingSystemMessage('booking_confirmed', 'Partner confirmed your stay! 🏠')
      loadConversations()
      toast.success(json.message || 'Бронирование подтверждено')
    } catch {
      toast.error('Ошибка сети')
    } finally {
      setBookingActionLoading(false)
    }
  }

  async function handleDeclineBookingHeader() {
    const bid = booking?.id
    if (!bid || !selectedConv?.id || bookingActionLoading) return
    setBookingActionLoading(true)
    try {
      const put = await fetch(`/api/v2/partner/bookings/${encodeURIComponent(bid)}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      })
      const json = await put.json()
      if (json.status !== 'success') {
        toast.error(json.error || 'Ошибка')
        return
      }
      setBooking((b) => (b ? { ...b, status: 'CANCELLED' } : b))
      await postBookingSystemMessage('booking_declined', 'Partner declined your booking request.')
      loadConversations()
      toast.success(json.message || 'Бронирование отклонено')
    } catch {
      toast.error('Ошибка сети')
    } finally {
      setBookingActionLoading(false)
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

  async function markAsRead(convId) {
    try {
      await fetch('/api/v2/chat/read', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: convId }),
      })
      loadConversations()
    } catch (error) {
      console.error('Failed to mark as read:', error)
    }
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!newMessage.trim() || !selectedConv || !user) return

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
        toast.error(json.error || 'Ошибка отправки')
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      toast.error('Ошибка отправки')
    } finally {
      setSending(false)
    }
  }

  async function handleSendPassportRequest() {
    if (!selectedConv || !user) return
    const res = await fetch('/api/v2/chat/messages', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: selectedConv.id,
        type: 'system',
        content: '',
        metadata: { system_key: 'passport_request' },
        skipPush: !!peerOnline,
      }),
    })
    const json = await res.json()
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Ошибка отправки')
    }
    const row = apiMessageToRow(json.data)
    if (row) setMessages((prev) => [...prev, row])
    loadConversations()
    scrollToBottom()
  }

  async function handleSendInvoice(invoiceData) {
    if (!selectedConv || !user) return

    try {
      const res = await fetch('/api/v2/chat/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConv.id,
          senderId: user.id,
          senderName: user.name || user.email || 'Partner',
          amount: invoiceData.amount,
          currency: invoiceData.currency,
          paymentMethod: invoiceData.paymentMethod,
          description: invoiceData.description,
          bookingId: booking?.id,
          listingId: listing?.id,
          listingTitle: listing?.title,
          checkIn: booking?.check_in,
          checkOut: booking?.check_out,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setMessages((prev) => [...prev, data.message])
        toast.success('Счёт отправлен!')
        scrollToBottom()
      } else {
        toast.error(data.error || 'Ошибка при отправке счёта')
      }
    } catch (error) {
      console.error('Send invoice error:', error)
      toast.error('Ошибка при отправке счёта')
    }
  }

  async function handleAttachFile(file) {
    if (!selectedConv || !user) return
    try {
      const { url } = await uploadChatFile(file, user.id)
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
    }
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-teal-600"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="p-4 lg:p-8">
        <div className="flex flex-col items-center justify-center h-96">
          <div className="text-center">
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Требуется авторизация</h3>
            <p className="text-slate-600">Войдите в систему для просмотра сообщений</p>
          </div>
        </div>
      </div>
    )
  }

  if (!categoryFilter && conversations.length === 0) {
    return (
      <div className="p-4 lg:p-8">
        <div className="flex flex-col items-center justify-center h-96">
          <MessageSquare className="h-16 w-16 text-slate-300 mb-4" />
          <div className="text-center">
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Нет сообщений</h3>
            <p className="text-slate-600">
              Когда клиенты или администраторы напишут вам, диалоги появятся здесь
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col lg:flex-row bg-slate-50">
      <ConversationList
        conversations={conversations}
        selectedId={conversationId}
        onSelect={(id) => router.push(`/partner/messages/${id}`)}
        categoryFilter={categoryFilter}
        onCategoryChange={setCategoryFilter}
        categories={categories}
        partnerSidebar
      />

      {conversationId && selectedConv ? (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-2 px-2 pt-2 lg:px-0 lg:pt-0 bg-white border-b lg:border-0">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden shrink-0"
              onClick={() => router.push('/partner/messages')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <StickyChatHeader
                listing={listing}
                booking={booking}
                isAdminView={false}
                contactName={
                  selectedConv.adminId
                    ? selectedConv.adminName || 'Поддержка'
                    : selectedConv.renterName || 'Клиент'
                }
                presenceOnline={peerParticipantId ? peerOnline : null}
                partnerBookingActions={{
                  visible:
                    !!booking?.id && String(booking.status || '').toUpperCase() === 'PENDING',
                  loading: bookingActionLoading,
                  onConfirm: handleConfirmBookingHeader,
                  onDecline: handleDeclineBookingHeader,
                }}
                onSupportClick={handleRequestSupport}
                supportLoading={supportLoading}
                supportPriorityActive={!!selectedConv?.isPriority}
                supportLabel="Помощь"
                supportDoneLabel="В поддержке"
              >
                <span
                  className={`flex items-center gap-1 text-xs ${isConnected ? 'text-green-600' : 'text-orange-500'}`}
                >
                  {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                  {isConnected ? 'Live' : '…'}
                </span>
              </StickyChatHeader>
            </div>
          </div>

          <ChatTypingBar name={peerTypingName} />

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 min-h-0">
            {messages.map((msg, idx) => {
              const prev = messages[idx - 1]
              const showDay = chatNeedsDaySeparator(prev?.created_at, msg.created_at)
              const dayLabel = chatDayLabel(msg.created_at, language)

              const isOwn = msg.sender_id === user?.id
              const isAdmin = msg.sender_role === 'ADMIN' || msg.sender_role === 'MODERATOR'
              const msgType = (msg.type || '').toLowerCase()
              const isRejection = msgType === 'rejection'
              const isInvoice = msgType === 'invoice' || msg.type === 'INVOICE'

              if (msgType === 'system') {
                const sk = msg.metadata?.system_key
                let sysTitle = null
                if (sk === 'passport_request') sysTitle = 'Запрос от партнёра'
                if (sk === 'booking_confirmed') sysTitle = 'Бронирование'
                if (sk === 'booking_declined') sysTitle = 'Бронирование'
                return (
                  <Fragment key={msg.id}>
                    {showDay ? <ChatDateSeparator label={dayLabel} /> : null}
                    <div className="flex justify-center px-2">
                      <div className="max-w-lg rounded-xl bg-slate-100 border border-slate-200 px-4 py-2 text-sm text-slate-700 text-center">
                        {sysTitle ? (
                          <p className="text-xs font-semibold text-teal-800 mb-1">{sysTitle}</p>
                        ) : null}
                        {msg.message ?? msg.content}
                      </div>
                    </div>
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
                        messageId={msg.id}
                        onInvoiceCancelled={() => {
                          setMessages((prevList) =>
                            prevList.map((m) =>
                              m.id === msg.id
                                ? {
                                    ...m,
                                    metadata: {
                                      ...m.metadata,
                                      invoice: {
                                        ...m.metadata.invoice,
                                        status: 'CANCELLED',
                                      },
                                    },
                                  }
                                : m
                            )
                          )
                        }}
                      />
                    </div>
                  </Fragment>
                )
              }

              const isBubble =
                ['text', 'image', 'file', 'rejection', ''].includes(msgType) || !msg.type

              if (isBubble) {
                return (
                  <Fragment key={msg.id}>
                    {showDay ? <ChatDateSeparator label={dayLabel} /> : null}
                    <MessageBubble
                      msg={msg}
                      isOwn={isOwn}
                      isAdmin={isAdmin}
                      isRejection={isRejection}
                      showSenderName={!isOwn}
                      senderName={msg.sender_name || 'User'}
                      translateTargetLang={language}
                      translateButtonLabels={{
                        translate: language === 'ru' ? 'Перевести' : 'Translate',
                        original: language === 'ru' ? 'Оригинал' : 'Original',
                        translating: '…',
                      }}
                      avatarFallback={
                        isAdmin ? (
                          <Shield className="h-4 w-4" />
                        ) : (
                          msg.sender_name?.[0]?.toUpperCase() || 'U'
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

          <PartnerChatComposer
            newMessage={newMessage}
            onMessageChange={(v) => {
              setNewMessage(v)
              broadcastTyping()
            }}
            onSubmit={sendMessage}
            sending={sending}
            disabled={!selectedConv}
            booking={booking}
            listing={listing}
            onSendInvoice={handleSendInvoice}
            onSendPassportRequest={handleSendPassportRequest}
            onAttachFile={handleAttachFile}
          />
        </div>
      ) : (
        <div className="flex-1 hidden lg:flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <MessageSquare className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Select a conversation</h3>
            <p className="text-slate-600">Choose a conversation from the list</p>
          </div>
        </div>
      )}
    </div>
  )
}
