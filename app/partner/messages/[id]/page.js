'use client'

import { Fragment, useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Loader2,
  ArrowLeft,
  AlertTriangle,
  MessageSquare,
  Shield,
  Wifi,
  WifiOff,
  Archive,
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
import { ChatDateSeparator } from '@/components/chat-date-separator'
import { uploadChatFile } from '@/lib/chat-upload'
import { useI18n } from '@/contexts/i18n-context'
import { chatDayLabel, chatNeedsDaySeparator } from '@/lib/chat-date-labels'
import { SupportRequestDialog } from '@/components/support-request-dialog'
import { ChatSupportTicketCard } from '@/components/chat-support-ticket-card'
import { ChatBookingAnnouncement } from '@/components/chat-booking-announcement'
import { PartnerChatCalendarPeek } from '@/components/partner-chat-calendar-peek'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { DECLINE_REASON_PRESETS } from '@/lib/booking-chat-copy'

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
  const [supportDialogOpen, setSupportDialogOpen] = useState(false)
  const [bookingActionLoading, setBookingActionLoading] = useState(false)
  const [declineOpen, setDeclineOpen] = useState(false)
  const [declinePreset, setDeclinePreset] = useState('occupied')
  const [declineOtherDetail, setDeclineOtherDetail] = useState('')
  const [threadLoading, setThreadLoading] = useState(false)

  const conversationId = params?.id
  const loadThreadSeq = useRef(0)

  const handleNewRealtimeMessage = useCallback(
    (newMsg) => {
      const isSystem = String(newMsg.type || '').toLowerCase() === 'system'
      const fromPeer = newMsg.sender_id !== user?.id
      if (fromPeer || isSystem) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev
          return [...prev, newMsg]
        })
        if (fromPeer) {
          playNotificationSound()
          toast.info('💬 Новое сообщение от гостя')
        }
      }
    },
    [user]
  )

  const handleMessageUpdate = useCallback((row) => {
    const merged = {
      ...row,
      is_read: row.is_read ?? row.isRead,
      isRead: row.is_read ?? row.isRead,
    }
    setMessages((prev) => prev.map((m) => (m.id === row.id ? { ...m, ...merged } : m)))
  }, [])

  const { isConnected } = useRealtimeMessages(
    conversationId,
    handleNewRealtimeMessage,
    handleMessageUpdate
  )
  const peerParticipantId = useMemo(() => {
    if (!selectedConv?.id || !user?.id) return null
    if (selectedConv.adminId) return selectedConv.adminId
    if (String(selectedConv.partnerId) === String(user.id)) return selectedConv.renterId
    return selectedConv.partnerId
  }, [selectedConv, user])

  const chatHeaderContactName = useMemo(() => {
    if (!selectedConv) return ''
    if (selectedConv.adminId) return selectedConv.adminName || 'Поддержка'
    if (String(selectedConv.partnerId) === String(user?.id)) {
      return selectedConv.renterName || (language === 'ru' ? 'Клиент' : 'Guest')
    }
    return selectedConv.partnerName || (language === 'ru' ? 'Хозяин' : 'Host')
  }, [selectedConv, user, language])

  const viewerIsListingHost = useMemo(() => {
    if (!selectedConv || !user?.id) return false
    return String(selectedConv.partnerId) === String(user.id)
  }, [selectedConv, user])

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

  const headerTypingLine = useMemo(() => {
    if (!peerTypingName) return null
    return language === 'ru' ? `${peerTypingName} печатает…` : `${peerTypingName} is typing…`
  }, [peerTypingName, language])

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

  const loadMessages = useCallback(async (convId) => {
    const seq = ++loadThreadSeq.current
    setThreadLoading(true)
    setSelectedConv(null)
    setListing(null)
    setBooking(null)
    setMessages([])
    try {
      const convRes = await fetch(
        `/api/v2/chat/conversations?id=${encodeURIComponent(convId)}&enrich=1`,
        { credentials: 'include' }
      )
      const convJson = await convRes.json()
      const conv = convJson.data?.[0]
      if (seq !== loadThreadSeq.current) return
      if (!conv) return

      setSelectedConv(conv)
      setListing(conv.listing || null)
      setBooking(conv.booking || null)

      const msgRes = await fetch(
        `/api/v2/chat/messages?conversationId=${encodeURIComponent(convId)}`,
        { credentials: 'include' }
      )
      const msgJson = await msgRes.json()
      if (seq !== loadThreadSeq.current) return
      if (!msgJson.success || !Array.isArray(msgJson.data)) {
        setMessages([])
        return
      }
      setMessages(msgJson.data.map(apiMessageToRow).filter(Boolean))
    } catch (error) {
      console.error('Failed to load messages:', error)
    } finally {
      if (seq === loadThreadSeq.current) setThreadLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!conversationId || !user) return
    loadMessages(conversationId)
    markAsRead(conversationId)
  }, [conversationId, user, loadMessages])

  useEffect(() => {
    if (conversationId) return
    if (conversations.length > 0 && user) {
      router.push(`/partner/messages/${conversations[0].id}`)
    }
  }, [conversationId, conversations, user, router])

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
      loadConversations()
      if (conversationId) loadMessages(conversationId)
      toast.success(json.message || 'Бронирование подтверждено')
    } catch {
      toast.error('Ошибка сети')
    } finally {
      setBookingActionLoading(false)
    }
  }

  function handleDeclineBookingHeader() {
    setDeclinePreset('occupied')
    setDeclineOtherDetail('')
    setDeclineOpen(true)
  }

  async function confirmDeclineBooking() {
    const bid = booking?.id
    if (!bid || !selectedConv?.id || bookingActionLoading) return
    if (declinePreset === 'other' && !declineOtherDetail.trim()) {
      toast.error(language === 'ru' ? 'Укажите комментарий для «Другое»' : 'Please add details for «Other»')
      return
    }
    setBookingActionLoading(true)
    try {
      const put = await fetch(`/api/v2/partner/bookings/${encodeURIComponent(bid)}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'CANCELLED',
          declineReasonKey: declinePreset,
          declineReasonDetail: declinePreset === 'other' ? declineOtherDetail.trim() : '',
        }),
      })
      const json = await put.json()
      if (json.status !== 'success') {
        toast.error(json.error || 'Ошибка')
        return
      }
      setBooking((b) => (b ? { ...b, status: 'CANCELLED' } : b))
      setDeclineOpen(false)
      setDeclineOtherDetail('')
      loadConversations()
      if (conversationId) loadMessages(conversationId)
      toast.success(json.message || 'Бронирование отклонено')
    } catch {
      toast.error('Ошибка сети')
    } finally {
      setBookingActionLoading(false)
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

  async function archiveConversationById(convId) {
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
        toast.error(
          json.error || (language === 'ru' ? 'Не удалось скрыть диалог' : 'Could not archive')
        )
        return
      }
      toast.success(language === 'ru' ? 'Диалог скрыт из списка' : 'Archived', {
        description:
          language === 'ru'
            ? 'Вернуть: раздел «Архив» в сообщениях'
            : 'Restore from Messages → Archive',
        action: {
          label: language === 'ru' ? 'Архив' : 'Archive',
          onClick: () => router.push('/partner/messages/archived'),
        },
      })
      const next = conversations.filter((c) => c.id !== convId)
      setConversations(next)
      if (String(conversationId) === String(convId)) {
        if (next.length) router.push(`/partner/messages/${next[0].id}`)
        else router.push('/partner/messages')
      }
    } catch {
      toast.error(language === 'ru' ? 'Ошибка сети' : 'Network error')
    }
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

  /* Не показываем «пусто», пока открыт конкретный диалог по URL — иначе мигание до загрузки списка */
  if (!categoryFilter && conversations.length === 0 && !conversationId) {
    return (
      <div className="p-4 lg:p-8">
        <div className="flex flex-col items-center justify-center h-96">
          <MessageSquare className="h-16 w-16 text-slate-300 mb-4" />
          <div className="text-center">
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Нет сообщений</h3>
            <p className="text-slate-600 mb-4">
              Когда клиенты или администраторы напишут вам, диалоги появятся здесь
            </p>
            <Link
              href="/partner/messages/archived"
              className="text-sm font-medium text-teal-700 hover:text-teal-900 underline underline-offset-2"
            >
              Архив скрытых диалогов
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-slate-50 lg:flex-row">
      <ConversationList
        conversations={conversations}
        selectedId={conversationId}
        onSelect={(id) => router.push(`/partner/messages/${id}`)}
        categoryFilter={categoryFilter}
        onCategoryChange={setCategoryFilter}
        categories={categories}
        partnerSidebar
        onArchiveConversation={(id) => {
          void archiveConversationById(id)
        }}
        archiveLabel={language === 'ru' ? 'Скрыть из списка' : 'Hide from list'}
        archivedListHref="/partner/messages/archived"
        archivedListLabel={language === 'ru' ? 'Архив' : 'Archive'}
      />

      {conversationId && threadLoading ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-slate-50 px-6 py-12 min-h-[50vh] lg:min-h-0">
          <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
          <p className="text-center text-sm text-slate-600">
            {language === 'ru' ? 'Загружаем диалог…' : 'Loading conversation…'}
          </p>
        </div>
      ) : conversationId && !selectedConv ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-slate-50 px-6 py-12 min-h-[50vh] lg:min-h-0">
          <MessageSquare className="h-12 w-12 text-slate-300" />
          <p className="text-center text-sm text-slate-600">
            {language === 'ru' ? 'Диалог не найден или нет доступа.' : 'Conversation not found or access denied.'}
          </p>
          <Button type="button" variant="outline" onClick={() => router.push('/partner/messages')}>
            {language === 'ru' ? 'К списку' : 'Back to list'}
          </Button>
        </div>
      ) : conversationId && selectedConv ? (
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 text-slate-600 border-slate-200 hidden sm:inline-flex"
              title={language === 'ru' ? 'Скрыть из списка' : 'Hide from list'}
              onClick={() => void archiveConversationById(selectedConv?.id)}
            >
              <Archive className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden md:inline">
                {language === 'ru' ? 'В архив' : 'Archive'}
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 sm:hidden text-slate-600"
              title={language === 'ru' ? 'Скрыть из списка' : 'Hide from list'}
              aria-label={language === 'ru' ? 'Скрыть из списка' : 'Hide from list'}
              onClick={() => void archiveConversationById(selectedConv?.id)}
            >
              <Archive className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0 min-h-0 overflow-x-hidden">
              <StickyChatHeader
                listing={listing}
                booking={booking}
                language={language}
                isAdminView={false}
                embedded
                compact
                showBookingTimeline={Boolean(booking?.id && booking?.status)}
                contactName={chatHeaderContactName}
                presenceOnline={peerParticipantId ? peerOnline : null}
                typingIndicator={headerTypingLine}
                typingGateWithPresence
                partnerBookingActions={{
                  visible:
                    viewerIsListingHost &&
                    !!booking?.id &&
                    String(booking.status || '').toUpperCase() === 'PENDING',
                  loading: bookingActionLoading,
                  onConfirm: handleConfirmBookingHeader,
                  onDecline: handleDeclineBookingHeader,
                }}
                onSupportClick={() => setSupportDialogOpen(true)}
                supportPriorityActive={!!selectedConv?.isPriority}
                supportLabel="Помощь"
              >
                <div className="flex items-center gap-2">
                  <PartnerChatCalendarPeek
                    listingId={listing?.id}
                    listingTitle={listing?.title}
                    language={language}
                  />
                  <span
                    className={`flex items-center gap-1 text-xs ${isConnected ? 'text-green-600' : 'text-orange-500'}`}
                  >
                    {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                    {isConnected ? 'Live' : '…'}
                  </span>
                </div>
              </StickyChatHeader>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-28 sm:pb-24 space-y-4 bg-slate-50 min-h-0 scroll-pb-24">
            {messages.map((msg, idx) => {
              const prev = messages[idx - 1]
              const showDay = chatNeedsDaySeparator(prev?.created_at, msg.created_at)
              const dayLabel = chatDayLabel(msg.created_at, language)

              const st = msg.metadata?.support_ticket
              if (st?.category && st?.disputeType) {
                return (
                  <Fragment key={msg.id}>
                    {showDay ? <ChatDateSeparator label={dayLabel} /> : null}
                    <div className="flex justify-center px-1">
                      <div className="w-full max-w-lg">
                        <ChatSupportTicketCard
                          ticket={st}
                          senderName={msg.sender_name}
                          language={language}
                        />
                      </div>
                    </div>
                  </Fragment>
                )
              }

              const isOwn = msg.sender_id === user?.id
              const isAdmin = msg.sender_role === 'ADMIN' || msg.sender_role === 'MODERATOR'
              const msgType = (msg.type || '').toLowerCase()
              const isRejection = msgType === 'rejection'
              const isInvoice = msgType === 'invoice' || msg.type === 'INVOICE'

              if (msgType === 'system') {
                const sk = msg.metadata?.system_key
                if (
                  msg.metadata?.booking_announcement ||
                  sk === 'booking_confirmed' ||
                  sk === 'booking_declined' ||
                  sk === 'booking_status_update'
                ) {
                  return (
                    <Fragment key={msg.id}>
                      {showDay ? <ChatDateSeparator label={dayLabel} /> : null}
                      <div className="flex justify-center px-2">
                        <ChatBookingAnnouncement message={msg} language={language} />
                      </div>
                    </Fragment>
                  )
                }
                let sysTitle = null
                if (sk === 'passport_request') sysTitle = 'Запрос от партнёра'
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
            language={language}
            onSendInvoice={viewerIsListingHost ? handleSendInvoice : undefined}
            onSendPassportRequest={viewerIsListingHost ? handleSendPassportRequest : undefined}
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

      <SupportRequestDialog
        open={supportDialogOpen}
        onOpenChange={setSupportDialogOpen}
        conversationId={selectedConv?.id}
        language={language}
        onSubmitted={() => {
          setSelectedConv((prev) => (prev ? { ...prev, isPriority: true } : prev))
          if (conversationId) loadMessages(conversationId)
          loadConversations()
        }}
      />

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {language === 'ru' ? 'Отклонить бронирование?' : 'Decline booking?'}
            </DialogTitle>
            <DialogDescription>
              {language === 'ru'
                ? 'Гость увидит уведомление в чате. По желанию укажите причину — так проще найти решение.'
                : 'The guest will see an update in chat. Optionally add a reason.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>{language === 'ru' ? 'Причина отказа' : 'Decline reason'}</Label>
            <RadioGroup value={declinePreset} onValueChange={setDeclinePreset} className="space-y-2">
              {(['occupied', 'repair', 'other']).map((key) => (
                <label
                  key={key}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50"
                >
                  <RadioGroupItem value={key} id={`decline-${key}`} />
                  <span className="text-sm text-slate-800">
                    {language === 'ru' ? DECLINE_REASON_PRESETS[key].ru : DECLINE_REASON_PRESETS[key].en}
                  </span>
                </label>
              ))}
            </RadioGroup>
            {declinePreset === 'other' ? (
              <div className="space-y-1">
                <Label htmlFor="decline-other">{language === 'ru' ? 'Комментарий' : 'Details'}</Label>
                <Textarea
                  id="decline-other"
                  value={declineOtherDetail}
                  onChange={(e) => setDeclineOtherDetail(e.target.value)}
                  rows={3}
                  placeholder={
                    language === 'ru' ? 'Кратко опишите причину…' : 'Briefly describe the reason…'
                  }
                  className="resize-none"
                />
              </div>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDeclineOpen(false)}>
              {language === 'ru' ? 'Отмена' : 'Cancel'}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={bookingActionLoading}
              onClick={() => void confirmDeclineBooking()}
            >
              {bookingActionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : language === 'ru' ? (
                'Отклонить'
              ) : (
                'Decline'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
