'use client'

import { Fragment, useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChatGrowingTextarea } from '@/components/chat-growing-textarea'
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
  Mic,
  MicOff,
  Trash2,
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
import { useRealtimeMessages, useRealtimeConversations, usePresence, playNotificationSound } from '@/hooks/use-realtime-chat'
import { useMarkConversationRead } from '@/hooks/use-mark-conversation-read'
import { useChatTyping } from '@/hooks/use-chat-typing'
import { toast } from 'sonner'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { useChatContext } from '@/lib/context/ChatContext'
import { useOptimisticSend } from '@/hooks/use-optimistic-send'
import { SupportRequestDialog } from '@/components/support-request-dialog'
import { ChatSupportTicketCard } from '@/components/chat-support-ticket-card'
import { ChatMilestoneCard } from '@/components/chat-milestone-card'
import { ChatImageCollage, groupConsecutiveImages } from '@/components/chat-image-collage'
import { ChatVoicePlayer } from '@/components/chat-voice-player'
import { useVoiceRecorder } from '@/hooks/use-voice-recorder'
import { ChatMediaGallery } from '@/components/chat-media-gallery'
import { ChatSearchBar } from '@/components/chat-search-bar'
import { getUIText } from '@/lib/translations'
import { ConversationList } from '@/components/conversation-list'
import { ChatActionBar } from '@/components/chat-action-bar'
import {
  INBOX_TAB_HOSTING,
  INBOX_TAB_TRAVELING,
  filterConversationsByInboxTab,
  sumUnreadInConversations,
  consumeRenterInboxTabPreference,
} from '@/lib/chat-inbox-tabs'

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
  const loadThreadSeq = useRef(0)
  const prevLoadedConversationIdRef = useRef(null)
  const [conversations, setConversations] = useState([])
  const [convHasMore, setConvHasMore] = useState(false)
  const [convOffset, setConvOffset] = useState(0)
  const [convLoadingMore, setConvLoadingMore] = useState(false)
  const [mediaGalleryOpen, setMediaGalleryOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchActive, setSearchActive] = useState(false)
  const [selectedConv, setSelectedConv] = useState(null)
  const [messages, setMessages] = useState([])
  const [listing, setListing] = useState(null)
  const [booking, setBooking] = useState(null)
  const [bookingStatus, setBookingStatus] = useState(null)
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [supportDialogOpen, setSupportDialogOpen] = useState(false)
  const [safetyWarningShown, setSafetyWarningShown] = useState(false)
  const [detectedPatterns, setDetectedPatterns] = useState([])
  const [categories, setCategories] = useState([])
  const [categoryFilter, setCategoryFilter] = useState(null)
  const [inboxTab, setInboxTab] = useState(INBOX_TAB_TRAVELING)
  const [threadLoading, setThreadLoading] = useState(false)

  const renterId = user?.id
  const conversationId = params?.id

  const handleNewRealtimeMessage = useCallback(
    (newMsg) => {
      const isSystem = String(newMsg.type || '').toLowerCase() === 'system'
      const fromPeer = newMsg.sender_id !== renterId
      if (fromPeer || isSystem) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev
          return [...prev, newMsg]
        })
        if (fromPeer) {
          playNotificationSound()
          toast.info('💬 Новое сообщение')
          // Мгновенно помечаем прочитанным → галочки синеют у отправителя
          markNow()
        }
      }
    },
    [renterId, markNow]
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
  const { isOnline: partnerOnline } = usePresence(
    conversationId,
    renterId,
    selectedConv?.partnerId || selectedConv?.adminId || null
  )

  // Отслеживаем "Был недавно": когда партнёр уходит оффлайн → записываем время
  const [partnerLastSeenAt, setPartnerLastSeenAt] = useState(null)
  const partnerOnlinePrevRef = useRef(null)
  useEffect(() => {
    if (partnerOnlinePrevRef.current === true && partnerOnline === false) {
      setPartnerLastSeenAt(new Date().toISOString())
    }
    partnerOnlinePrevRef.current = partnerOnline
  }, [partnerOnline])

  const { markNow } = useMarkConversationRead(conversationId, !!(conversationId && renterId), partnerOnline)

  // Оптимистично сбрасываем счётчик в глобальном ChatContext при открытии треда
  const { markConversationRead: markGlobalRead, refresh: refreshChat } = useChatContext()
  useEffect(() => {
    if (conversationId) {
      markGlobalRead(conversationId)
    }
  }, [conversationId, markGlobalRead])

  // ChatContext теперь управляет своим Realtime сам; здесь только обновляем локальный список
  useRealtimeConversations(renterId, () => loadConversations())

  const { sendText: optimisticSendText } = useOptimisticSend({
    conversationId,
    userId: renterId,
    setMessages,
  })

  // ─── Голосовые сообщения ───────────────────────────────────────────────────
  const {
    isRecording: voiceRecording,
    duration: voiceDuration,
    durationLabel: voiceDurationLabel,
    audioBlob: voiceBlob,
    audioUrl: voicePreviewUrl,
    startRecording: startVoice,
    stopRecording: stopVoice,
    discardRecording: discardVoice,
  } = useVoiceRecorder()

  const [voiceSending, setVoiceSending] = useState(false)

  async function handleSendVoice() {
    if (!voiceBlob || !renterId || !selectedConv) return
    setVoiceSending(true)
    try {
      const ext = voiceBlob.type.includes('ogg') ? 'ogg' : voiceBlob.type.includes('mp4') ? 'mp4' : 'webm'
      const file = new File([voiceBlob], `voice_${Date.now()}.${ext}`, { type: voiceBlob.type })
      const { url } = await uploadChatFile(file, renterId)
      const res = await fetch('/api/v2/chat/messages', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConv.id,
          type: 'voice',
          content: '',
          metadata: { voice_url: url, duration_sec: voiceDuration },
          skipPush: !!partnerOnline,
        }),
      })
      const json = await res.json()
      if (res.ok && json.success && json.data) {
        setMessages((prev) => [...prev, json.data])
        discardVoice()
        loadConversations()
      } else {
        toast.error(json.error || 'Ошибка отправки голосового')
      }
    } catch {
      toast.error('Ошибка сети')
    } finally {
      setVoiceSending(false)
    }
  }

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

  // Two-hat context: the same user can be a host on one conversation and a guest on another.
  const isHosting = useMemo(
    () => !!(selectedConv?.id && renterId && String(selectedConv.partnerId) === String(renterId)),
    [selectedConv, renterId]
  )
  const isTraveling = useMemo(
    () => !!(selectedConv?.id && renterId && String(selectedConv.renterId) === String(renterId)),
    [selectedConv, renterId]
  )

  const payNowHref = useMemo(() => {
    if (isHosting) return null      // hosts don't pay; they receive
    if (!booking?.id) return null
    if (String(booking.status || '').toUpperCase() !== 'CONFIRMED') return null
    for (let i = messages.length - 1; i >= 0; i--) {
      const inv = messages[i]?.metadata?.invoice
      if (!inv) continue
      if (String(inv.booking_id || '') !== String(booking.id)) continue
      const st = String(inv.status || 'PENDING').toUpperCase()
      if (st !== 'PENDING') continue
      const pm = String(inv.payment_method || 'CRYPTO').toUpperCase()
      const q = pm === 'CARD' || pm === 'CARD_INTL' ? 'CARD' : pm === 'MIR' || pm === 'CARD_RU' ? 'MIR' : 'CRYPTO'
      return `/checkout/${encodeURIComponent(booking.id)}?pm=${q}`
    }
    return null
  }, [messages, booking])

  const hostingUnread = useMemo(
    () =>
      sumUnreadInConversations(
        filterConversationsByInboxTab(conversations, renterId, INBOX_TAB_HOSTING)
      ),
    [conversations, renterId]
  )

  const travelingUnread = useMemo(
    () =>
      sumUnreadInConversations(
        filterConversationsByInboxTab(conversations, renterId, INBOX_TAB_TRAVELING)
      ),
    [conversations, renterId]
  )

  const filteredConversations = useMemo(
    () => filterConversationsByInboxTab(conversations, renterId, inboxTab),
    [conversations, renterId, inboxTab]
  )

  const handleInboxTabChange = useCallback(
    (next) => {
      setInboxTab(next)
      const list = filterConversationsByInboxTab(conversations, renterId, next)
      if (conversationId && !list.some((c) => c.id === conversationId)) {
        const first = list[0]
        if (first) router.push(`/renter/messages/${first.id}`)
        else router.push('/renter/messages')
      }
    },
    [conversations, renterId, conversationId, router]
  )

  // document.title теперь управляется глобально через ChatContext (lib/context/ChatContext.jsx)

  useEffect(() => {
    const p = consumeRenterInboxTabPreference()
    if (p) setInboxTab(p)
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
    if (!conversationId || !selectedConv?.id || !renterId) return
    if (String(selectedConv.id) !== String(conversationId)) return
    const isHost = String(selectedConv.partnerId) === String(renterId)
    setInboxTab(isHost ? INBOX_TAB_HOSTING : INBOX_TAB_TRAVELING)
  }, [conversationId, selectedConv?.id, selectedConv?.partnerId, renterId])

  useEffect(() => {
    if (authLoading) return
    if (!renterId) {
      setLoading(false)
      return
    }
    loadConversations()
  }, [renterId, authLoading, categoryFilter])

  useEffect(() => {
    if (conversationId && renterId) {
      loadMessages(conversationId)
    }
  }, [conversationId, renterId])

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

  async function loadConversations(opts = {}) {
    const { offset = 0, append = false } = opts
    if (!renterId) return
    if (append) setConvLoadingMore(true)
    try {
      const params = new URLSearchParams({ enrich: '1', limit: '20', offset: String(offset) })
      if (categoryFilter) params.set('listing_category', categoryFilter)
      const res = await fetch(`/api/v2/chat/conversations?${params}`, { credentials: 'include' })
      const data = await res.json()
      if (data.success && Array.isArray(data.data)) {
        if (append) {
          setConversations((prev) => {
            const existingIds = new Set(prev.map((c) => c.id))
            const fresh = data.data.filter((c) => !existingIds.has(c.id))
            return [...prev, ...fresh]
          })
        } else {
          setConversations(data.data)
          setConvOffset(0)
        }
        setConvHasMore(!!data.meta?.hasMore)
        if (append) setConvOffset(offset)
      }
    } catch (error) {
      console.error('Failed to load conversations:', error)
    } finally {
      setLoading(false)
      if (append) setConvLoadingMore(false)
    }
  }

  function handleLoadMoreConversations() {
    if (!convHasMore || convLoadingMore) return
    const nextOffset = convOffset + 20
    loadConversations({ offset: nextOffset, append: true })
  }

  function mergeListingFromNavigationContext(convId, apiListing, convListingId) {
    if (typeof window === 'undefined') return apiListing || null
    try {
      const raw = sessionStorage.getItem(`gostaylo_chat_context_listing_${convId}`)
      if (!raw) return apiListing || null
      const ctx = JSON.parse(raw)
      if (!ctx?.listingId || String(ctx.listingId) !== String(convListingId || '')) {
        return apiListing || null
      }
      sessionStorage.removeItem(`gostaylo_chat_context_listing_${convId}`)
      const base = apiListing && typeof apiListing === 'object' ? { ...apiListing } : {}
      return {
        ...base,
        id: ctx.listingId,
        title: ctx.title ?? base.title ?? '—',
        images: Array.isArray(ctx.images) ? ctx.images : base.images,
        district: ctx.district ?? base.district ?? null,
      }
    } catch {
      return apiListing || null
    }
  }

  /**
   * Черновик с листинга: только «первое касание» — в диалоге ещё нет сообщений от пользователя
   * и нет истории сообщений (messages.length === 0), иначе ключ удаляем без подстановки.
   */
  function tryApplyListingPrefillDraft(convId, rows, currentUserId) {
    if (typeof window === 'undefined') return
    const key = `gostaylo_chat_prefill_${convId}`
    let draft = null
    try {
      draft = sessionStorage.getItem(key)
    } catch {
      return
    }
    if (!draft || !currentUserId) return

    const userSent = rows.some((m) => String(m.sender_id || m.senderId) === String(currentUserId))
    if (rows.length > 0 || userSent) {
      try {
        sessionStorage.removeItem(key)
      } catch {
        /* ignore */
      }
      return
    }

    try {
      sessionStorage.removeItem(key)
    } catch {
      /* ignore */
    }
    setNewMessage((prev) => (prev.trim() ? prev : draft))
  }

  async function loadMessages(convId) {
    const seq = ++loadThreadSeq.current
    const prevConv = prevLoadedConversationIdRef.current
    if (prevConv !== null && prevConv !== convId) {
      setMessages([])
      setNewMessage('')
    }
    prevLoadedConversationIdRef.current = convId

    setThreadLoading(true)
    try {
      const convRes = await fetch(
        `/api/v2/chat/conversations?id=${encodeURIComponent(convId)}&enrich=1`,
        { credentials: 'include' }
      )
      const convJson = await convRes.json()
      const conv = convJson.data?.[0]
      if (seq !== loadThreadSeq.current) return
      if (!conv) return

      const convListingId = conv.listingId ?? conv.listing_id
      const mergedListing = mergeListingFromNavigationContext(convId, conv.listing || null, convListingId)

      setSelectedConv(conv)
      setListing(mergedListing)
      setBooking(conv.booking || null)

      const msgRes = await fetch(
        `/api/v2/chat/messages?conversationId=${encodeURIComponent(convId)}`,
        { credentials: 'include' }
      )
      const msgJson = await msgRes.json()
      let rows = []
      if (msgJson.success && Array.isArray(msgJson.data)) {
        rows = msgJson.data.map(apiMessageToRow).filter(Boolean)
        setMessages(rows)

        const bookingRequestMsg = rows.find((m) =>
          String(m.type || '').toUpperCase().includes('BOOKING')
        )
        const bid = bookingRequestMsg?.metadata?.booking_id || bookingRequestMsg?.bookingId
        if (bid) fetchBookingStatus(bid)
      } else {
        setMessages([])
      }

      if (seq !== loadThreadSeq.current) return

      tryApplyListingPrefillDraft(convId, rows, renterId)

      await fetch('/api/v2/chat/read', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: convId }),
      })
      loadConversations()
    } catch (error) {
      console.error('Failed to load messages:', error)
    } finally {
      if (seq === loadThreadSeq.current) setThreadLoading(false)
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
    const text = newMessage.trim()
    setNewMessage('')
    setSending(true)
    try {
      await optimisticSendText(text, { skipPush: !!partnerOnline })
      loadConversations()
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
        toast.error(json.error || (language === 'ru' ? 'Не удалось скрыть диалог' : 'Could not archive'))
        return
      }
      toast.success(language === 'ru' ? 'Диалог скрыт из списка' : 'Archived', {
        description:
          language === 'ru'
            ? 'Вернуть или открыть снова — раздел «Архив» в сообщениях'
            : 'Restore from Messages → Archive',
        action: {
          label: language === 'ru' ? 'Архив' : 'Archive',
          onClick: () => router.push('/renter/messages/archived'),
        },
      })
      const next = conversations.filter((c) => c.id !== convId)
      setConversations(next)
      if (String(conversationId) === String(convId)) {
        const list = filterConversationsByInboxTab(next, renterId, inboxTab)
        const first = list[0]
        if (first) router.push(`/renter/messages/${first.id}`)
        else router.push('/renter/messages')
      }
    } catch {
      toast.error(language === 'ru' ? 'Ошибка сети' : 'Network error')
    }
  }

  async function handleArchiveDialog() {
    if (!selectedConv?.id) return
    await archiveConversationById(selectedConv.id)
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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-white border-b sticky top-0 z-10 shrink-0">
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

      <div className="flex min-h-0 min-w-0 flex-1 w-full max-w-[1600px] mx-auto px-2 sm:px-4 py-4">
        <div className="flex w-full min-h-[min(72dvh,760px)] flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:flex-row">
          <ConversationList
            conversations={filteredConversations}
            selectedId={conversationId}
            onSelect={(id) => router.push(`/renter/messages/${id}`)}
            categoryFilter={categoryFilter}
            onCategoryChange={setCategoryFilter}
            categories={categories}
            partnerSidebar
            partnerListAsGuest={inboxTab === INBOX_TAB_TRAVELING}
            sidebarLang={language === 'en' ? 'en' : 'ru'}
            inboxTab={inboxTab}
            onInboxTabChange={handleInboxTabChange}
            hostingUnread={hostingUnread}
            travelingUnread={travelingUnread}
            inboxTabsLang={language === 'en' ? 'en' : 'ru'}
            onArchiveConversation={(id) => void archiveConversationById(id)}
            archiveLabel={language === 'ru' ? 'Скрыть из списка' : 'Hide from list'}
            archivedListHref="/renter/messages/archived"
            archivedListLabel={language === 'ru' ? 'Архив' : 'Archive'}
            onLoadMore={handleLoadMoreConversations}
            hasMore={convHasMore}
            loadingMore={convLoadingMore}
          />

          <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-slate-50">
            {threadLoading ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 min-h-[50vh] lg:min-h-0">
                <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
                <p className="text-center text-sm text-slate-600">
                  {language === 'ru' ? 'Загружаем диалог…' : 'Loading conversation…'}
                </p>
              </div>
            ) : !selectedConv ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 min-h-[50vh] lg:min-h-0">
                <p className="text-center text-sm text-slate-600">
                  {language === 'ru' ? 'Диалог не найден или нет доступа.' : 'Conversation not found or access denied.'}
                </p>
                <Button type="button" variant="outline" onClick={() => router.push('/renter/messages')}>
                  {language === 'ru' ? 'К списку' : 'Back to list'}
                </Button>
              </div>
            ) : (
              <div className="flex flex-1 flex-col min-h-0">
                <div className="flex items-center gap-2 px-2 pt-2 lg:px-0 lg:pt-0 bg-white border-b lg:border-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden shrink-0"
                    onClick={() => router.push('/renter/messages')}
                    aria-label={language === 'ru' ? 'К списку диалогов' : 'Back to conversations'}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 text-slate-600 border-slate-200 hidden sm:inline-flex"
                    title={language === 'ru' ? 'Скрыть из списка' : 'Hide from list'}
                    onClick={() => void handleArchiveDialog()}
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
                    onClick={() => void handleArchiveDialog()}
                  >
                    <Archive className="h-5 w-5" />
                  </Button>
                  <Link
                    href="/renter/messages/archived"
                    className="hidden lg:inline text-xs font-medium text-teal-700 hover:text-teal-900 underline underline-offset-2 shrink-0"
                  >
                    {language === 'ru' ? 'Архив' : 'Archive'}
                  </Link>
                  <div className="flex-1 min-w-0 min-h-0 overflow-x-hidden">
                    <StickyChatHeader
                      listing={listing}
                      booking={booking}
                      language={language}
                      isAdminView={false}
                      embedded
                      compact
                      showBookingTimeline={Boolean(booking?.id && booking?.status)}
                      contactName={selectedConv?.partnerName || 'Партнёр'}
                      presenceOnline={partnerOnline}
                      lastSeenAt={partnerLastSeenAt}
                      typingIndicator={headerTypingLine}
                      typingGateWithPresence
                      onMediaGallery={selectedConv ? () => setMediaGalleryOpen(true) : null}
                      onSearchToggle={() => { setSearchActive((v) => !v); setSearchQuery('') }}
                      searchActive={searchActive}
                      payNowHref={payNowHref}
                      onSupportClick={() => setSupportDialogOpen(true)}
                      supportPriorityActive={!!selectedConv?.isPriority}
                      supportLabel="Помощь"
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
                    {/* Поиск по сообщениям */}
                    {searchActive && (
                      <ChatSearchBar
                        value={searchQuery}
                        onChange={setSearchQuery}
                        resultCount={searchQuery.trim() ? messages.filter((m) => {
                          const t = m.message || m.content || ''
                          return t.toLowerCase().includes(searchQuery.toLowerCase())
                        }).length : null}
                        onClose={() => { setSearchActive(false); setSearchQuery('') }}
                        language={language}
                      />
                    )}
                  </div>
                </div>

                {/* Медиа-галерея */}
                <ChatMediaGallery
                  messages={messages}
                  open={mediaGalleryOpen}
                  onClose={() => setMediaGalleryOpen(false)}
                  language={language}
                />

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

                <Card className="overflow-hidden flex flex-col min-h-0 flex-1 border-0 shadow-none rounded-none sm:rounded-lg sm:border sm:border-slate-200 sm:shadow-sm mx-2 mb-2 sm:mx-0 sm:mb-0">
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 pb-28 sm:pb-24 space-y-4 scroll-pb-24">
                {groupConsecutiveImages(
                  searchQuery.trim()
                    ? messages.filter((m) => {
                        const t = m.message || m.content || ''
                        return t.toLowerCase().includes(searchQuery.toLowerCase())
                      })
                    : messages
                ).map((item, idx, arr) => {
                  const msgDate = item._imageGroup ? item.messages[0].created_at : item.created_at
                  const prevItem = arr[idx - 1]
                  const prevDate = prevItem ? (prevItem._imageGroup ? prevItem.messages[prevItem.messages.length - 1].created_at : prevItem.created_at) : null
                  const showDay = chatNeedsDaySeparator(prevDate, msgDate)
                  const dayLabel = chatDayLabel(msgDate, language)

                  // ─── Группа изображений ───────────────────────────────────
                  if (item._imageGroup) {
                    const first = item.messages[0]
                    const isOwnGrp = first.sender_id === renterId
                    return (
                      <Fragment key={item.id}>
                        {showDay ? <ChatDateSeparator label={dayLabel} /> : null}
                        <div className={`flex ${isOwnGrp ? 'justify-end' : 'justify-start'}`}>
                          <ChatImageCollage
                            images={item.messages.map((m) => ({
                              id: m.id,
                              url: m.metadata?.image_url || m.metadata?.url,
                              alt: m.message || '',
                            }))}
                            isOwn={isOwnGrp}
                          />
                        </div>
                      </Fragment>
                    )
                  }

                  const msg = item
                  const st = msg.metadata?.support_ticket
                  if (st?.category && st?.disputeType) {
                    return (
                      <Fragment key={msg.id}>
                        {showDay ? <ChatDateSeparator label={dayLabel} /> : null}
                        <div className="flex justify-center px-1">
                          <div className="w-full max-w-lg">
                            <ChatSupportTicketCard
                              ticket={st}
                              senderName={msg.sender_name || msg.senderName}
                              language={language}
                            />
                          </div>
                        </div>
                      </Fragment>
                    )
                  }

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
                    return (
                      <Fragment key={msg.id}>
                        {showDay ? <ChatDateSeparator label={dayLabel} /> : null}
                        <ChatMilestoneCard message={msg} language={language} userRole="renter" />
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

                  const voiceMsgType = String(msg.type || '').toLowerCase()
                  if (voiceMsgType === 'voice' && msg.metadata?.voice_url) {
                    const isOwn = msg.sender_id === renterId || msg.senderId === renterId
                    return (
                      <Fragment key={msg.id}>
                        {showDay ? <ChatDateSeparator label={dayLabel} /> : null}
                        <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                          <ChatVoicePlayer
                            url={msg.metadata.voice_url}
                            durationSec={msg.metadata.duration_sec || 0}
                            isOwn={isOwn}
                          />
                        </div>
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
                    const bookingPaid = ['CONFIRMED', 'PAID', 'COMPLETED', 'CHECKED_IN', 'CHECKED_OUT'].includes(
                      String(booking?.status || '').toUpperCase()
                    )
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
                          maskContacts={!bookingPaid}
                          searchHighlight={searchQuery.trim() || undefined}
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

              <ChatActionBar
                isHosting={isHosting}
                isTraveling={isTraveling}
                booking={booking}
                payNowHref={payNowHref}
                language={language}
              />
              <div className="shrink-0 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
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
                <form onSubmit={sendMessage} className="flex gap-2 items-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="flex-shrink-0 border-slate-200 h-10 w-10"
                    disabled={sending}
                    aria-label="Прикрепить файл"
                    onClick={() => attachFileRef.current?.click()}
                  >
                    <Paperclip className="h-5 w-5" />
                  </Button>
                  {/* Голосовое — предпросмотр */}
                  {voiceBlob ? (
                    <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-teal-50 border border-teal-200">
                      <audio src={voicePreviewUrl} controls className="h-8 flex-1 min-w-0" />
                      <span className="text-xs text-teal-700 font-medium tabular-nums shrink-0">{voiceDurationLabel}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50 shrink-0" onClick={discardVoice}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button type="button" disabled={voiceSending} className="h-8 px-3 bg-teal-600 hover:bg-teal-700 shrink-0" onClick={handleSendVoice}>
                        {voiceSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                  ) : voiceRecording ? (
                    <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                      <span className="text-sm text-red-700 font-medium flex-1">Запись... {voiceDurationLabel}</span>
                      <Button type="button" size="icon" className="h-8 w-8 bg-red-500 hover:bg-red-600 shrink-0" onClick={stopVoice}>
                        <MicOff className="h-4 w-4 text-white" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <ChatGrowingTextarea
                        value={newMessage}
                        onChange={(v) => {
                          setNewMessage(v)
                          broadcastTyping()
                        }}
                        placeholder={getUIText('chatComposerPlaceholder', language)}
                        disabled={sending}
                      />
                      {!newMessage.trim() && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="flex-shrink-0 h-10 w-10 border-slate-200 text-slate-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                          disabled={sending}
                          onClick={startVoice}
                          title="Голосовое сообщение"
                        >
                          <Mic className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        type="submit"
                        disabled={!newMessage.trim() || sending}
                        className="bg-teal-600 hover:bg-teal-700 flex-shrink-0 h-10 w-10 sm:w-auto sm:px-4"
                      >
                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </>
                  )}
                </form>
              </div>
            </Card>
              </div>
            )}
          </div>
        </div>
      </div>

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
    </div>
  )
}
