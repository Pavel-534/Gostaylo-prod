'use client'

/**
 * @file app/renter/messages/[id]/RenterMessagesClient.jsx
 *
 * Client-компонент для страницы сообщений рентера/гостя.
 * Собирает все хуки фаз 1-3 и рендерит ChatThreadChrome.
 *
 * Особенности рентера vs партнёра:
 *   – SafetyBanner: предупреждение о мошенниках если бронь не оплачена
 *   – Голосовые сообщения через useVoiceRecorder (встроенный UI-рекордер)
 *   – ChatGrowingTextarea вместо PartnerChatComposer
 *   – Нет диалога отклонения, нет SendInvoice, нет PassportRequest
 *   – Блок «Нужен транспорт?» если бронь PAID
 *   – openLoginModal для неавторизованных
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'
import {
  Archive, Loader2, Home,
  Mic, MicOff, Paperclip, Send,
  Wifi, WifiOff, Trash2,
  Plus, LifeBuoy, Images, Search, Calendar,
} from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ChatGrowingTextarea } from '@/components/chat-growing-textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { useI18n } from '@/contexts/i18n-context'
import { useAuth } from '@/contexts/auth-context'
import { useChatContext } from '@/lib/context/ChatContext'
import { getUIText } from '@/lib/translations'

// ─── Хуки Фазы 2 ──────────────────────────────────────────────────────────────
import { useChatThreadMessages } from '@/hooks/use-chat-thread-messages'
import { useConversationInbox } from '@/hooks/use-conversation-inbox'

// ─── Голос ────────────────────────────────────────────────────────────────────
import { useVoiceRecorder } from '@/hooks/use-voice-recorder'

// ─── Инфраструктура ───────────────────────────────────────────────────────────
import { usePresence } from '@/hooks/use-realtime-chat'
import { useMarkConversationRead } from '@/hooks/use-mark-conversation-read'
import { useChatTyping } from '@/hooks/use-chat-typing'

// ─── Компоненты Фазы 3 ────────────────────────────────────────────────────────
import { ChatThreadChrome } from '@/components/chat/ChatThreadChrome'
import { ChatMessageList } from '@/components/chat/ChatMessageList'
import { ConversationList } from '@/components/chat/ConversationList'

// ─── Существующие UI-компоненты ───────────────────────────────────────────────
import { StickyChatHeader } from '@/components/sticky-chat-header'
import { ChatActionBar } from '@/components/chat-action-bar'
import { ChatSearchBar } from '@/components/chat-search-bar'
import { ChatMediaGallery } from '@/components/chat-media-gallery'
import { PartnerChatComposer } from '@/components/partner-chat-composer'
import { conversationMessagesHref } from '@/components/chat/conversation-messages-href'
import { DealDetailsCard } from '@/components/chat/DealDetailsCard'
import { SupportRequestDialog } from '@/components/support-request-dialog'
import { PartnerChatCalendarPeek } from '@/components/partner-chat-calendar-peek'
import { detectUnsafePatterns, SafetyBanner } from '@/components/chat-safety'
import { uploadChatFile, uploadChatVoice } from '@/lib/chat-upload'
import {
  INBOX_TAB_HOSTING,
  INBOX_TAB_TRAVELING,
  consumeRenterInboxTabPreference,
} from '@/lib/chat-inbox-tabs'
import { DECLINE_REASON_PRESETS } from '@/lib/booking-chat-copy'
import { isBookingPaid } from '@/lib/mask-contacts'
import { countSearchResults } from '@/lib/chat/message-filters'
import { mapApiMessageToRow } from '@/lib/chat/map-api-message'
import { CHAT_COMPOSER_SHELL_CLASS } from '@/lib/chat-ui'

// ─── Категории ────────────────────────────────────────────────────────────────
function useCategories() {
  const [categories, setCategories] = useState([])
  useEffect(() => {
    fetch('/api/v2/categories')
      .then((r) => r.json())
      .then((d) => { if (d.success && Array.isArray(d.data)) setCategories(d.data) })
      .catch(() => {})
  }, [])
  return categories
}

// ─── Archive helper ───────────────────────────────────────────────────────────
function useArchive({ language, router, inbox, conversationId, basePath, userId }) {
  const archiveConversation = useCallback(async (convId) => {
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
        toast.error(json.error || (language === 'ru' ? 'Не удалось скрыть' : 'Could not archive'))
        return
      }
      toast.success(language === 'ru' ? 'Диалог скрыт' : 'Archived', {
        action: {
          label: language === 'ru' ? 'Архив' : 'Archive',
          onClick: () => router.push(`${basePath}/archived`),
        },
      })
      inbox.setConversations((prev) => prev.filter((c) => c.id !== convId))
      if (String(conversationId) === String(convId)) {
        const remaining = inbox.filteredConversations.filter((c) => c.id !== convId)
        if (remaining[0]) {
          const next = conversationMessagesHref(userId, remaining[0]) || `${basePath}/${remaining[0].id}`
          router.push(next)
        } else router.push(basePath)
      }
    } catch {
      toast.error(language === 'ru' ? 'Ошибка сети' : 'Network error')
    }
  }, [language, router, inbox, conversationId, basePath, userId])

  return { archiveConversation }
}

// ─── Главный компонент ────────────────────────────────────────────────────────

export default function RenterMessagesClient({ params }) {
  const router = useRouter()
  const pathname = usePathname()
  const messagesListBase = pathname?.startsWith('/partner') ? '/partner/messages' : '/renter/messages'
  const { language } = useI18n()
  const { user, loading: authLoading, openLoginModal } = useAuth()
  const { markConversationRead: markGlobalRead } = useChatContext()

  const conversationId = params?.id
  const renterId = user?.id
  const categories = useCategories()
  const attachFileRef = useRef(null)

  // ── UI-стейт ────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('')
  const [searchActive, setSearchActive] = useState(false)
  const [mediaGalleryOpen, setMediaGalleryOpen] = useState(false)
  const [supportDialogOpen, setSupportDialogOpen] = useState(false)
  const [dealSheetOpen, setDealSheetOpen] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [declineOpen, setDeclineOpen] = useState(false)
  const [declinePreset, setDeclinePreset] = useState('occupied')
  const [declineOtherDetail, setDeclineOtherDetail] = useState('')
  const [bookingActionLoading, setBookingActionLoading] = useState(false)
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [voiceSending, setVoiceSending] = useState(false)
  const [safetyWarningShown, setSafetyWarningShown] = useState(false)
  const [detectedPatterns, setDetectedPatterns] = useState([])

  // Голосовой рекордер
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

  // ── Инбокс (Фаза 2) ─────────────────────────────────────────────────────────
  const inbox = useConversationInbox({
    userId: renterId,
    defaultTab: INBOX_TAB_TRAVELING,
    enabled: !!renterId,
  })

  // Читаем сохранённое предпочтение вкладки
  useEffect(() => {
    const p = consumeRenterInboxTabPreference()
    if (p) inbox.setInboxTab(p)
  }, [])

  // ── Тред (Фаза 2) ───────────────────────────────────────────────────────────
  const {
    messages, isLoading: threadLoading, isConnected,
    selectedConv, listing, booking,
    sendMessage: _sendMessage, sendMedia,
    reload: reloadThread,
    setMessages, setSelectedConv, setBooking,
  } = useChatThreadMessages({
    conversationId,
    userId: renterId,
    viewerRole: 'renter',
    onMarkRead: () => { if (conversationId) markGlobalRead(conversationId) },
    onNewMessage: () => {
      inbox.refresh()
      markNow()
    },
  })

  // Глобальный сброс badge
  useEffect(() => {
    if (conversationId) markGlobalRead(conversationId)
  }, [conversationId, markGlobalRead])

  const tabSyncedForConvRef = useRef(null)
  useEffect(() => {
    tabSyncedForConvRef.current = null
  }, [conversationId])
  useEffect(() => {
    if (!conversationId || !selectedConv?.id || !renterId) return
    if (String(selectedConv.id) !== String(conversationId)) return
    if (tabSyncedForConvRef.current === conversationId) return
    tabSyncedForConvRef.current = conversationId
    const isHost = String(selectedConv.partnerId) === String(renterId)
    inbox.setInboxTab(isHost ? INBOX_TAB_HOSTING : INBOX_TAB_TRAVELING)
  }, [conversationId, selectedConv?.id, selectedConv?.partnerId, renterId])

  // ── Safety detection ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!messages.length || safetyWarningShown) return
    const patterns = []
    messages.forEach((msg) => {
      const text = msg.message || msg.content || ''
      const result = detectUnsafePatterns(text)
      if (result.hasRisk) patterns.push(...result.patterns)
    })
    if (patterns.length) setDetectedPatterns(patterns)
  }, [messages, safetyWarningShown])

  // ── Роли ────────────────────────────────────────────────────────────────────
  const isHosting = useMemo(
    () => !!(selectedConv?.id && renterId && String(selectedConv.partnerId) === String(renterId)),
    [selectedConv, renterId]
  )
  const isTraveling = !isHosting

  // ── Presence / Typing (собеседник: гость если я хозяин, иначе хозяин) ───────────
  const partnerPeerId = useMemo(() => {
    if (!selectedConv) return null
    if (selectedConv.adminId) return selectedConv.adminId
    if (String(selectedConv.partnerId) === String(renterId)) return selectedConv.renterId
    return selectedConv.partnerId
  }, [selectedConv, renterId])
  const { isOnline: partnerOnline } = usePresence(conversationId, renterId, partnerPeerId)

  const [partnerLastSeenAt, setPartnerLastSeenAt] = useState(null)
  const partnerOnlinePrevRef = useRef(null)
  useEffect(() => {
    if (partnerOnlinePrevRef.current === true && partnerOnline === false) {
      setPartnerLastSeenAt(new Date().toISOString())
    }
    partnerOnlinePrevRef.current = partnerOnline
  }, [partnerOnline])

  const { markNow } = useMarkConversationRead(conversationId, !!(conversationId && renterId), partnerOnline)

  const renterDisplayName = useMemo(() => {
    if (!user) return 'Гость'
    const n = [user.first_name, user.last_name].filter(Boolean).join(' ').trim()
    return n || user.name || user.email || 'Гость'
  }, [user])

  const { peerTypingName, broadcastTyping } = useChatTyping(conversationId, renterId, renterDisplayName)
  const typingLine = useMemo(() => {
    if (!peerTypingName) return null
    return language === 'ru' ? `${peerTypingName} печатает…` : `${peerTypingName} is typing…`
  }, [peerTypingName, language])

  // ── Pay now href ─────────────────────────────────────────────────────────────
  const payNowHref = useMemo(() => {
    if (isHosting || !booking?.id) return null
    if (String(booking.status || '').toUpperCase() !== 'CONFIRMED') return null
    for (let i = messages.length - 1; i >= 0; i--) {
      const inv = messages[i]?.metadata?.invoice
      if (!inv || String(inv.booking_id || '') !== String(booking.id)) continue
      if (String(inv.status || 'PENDING').toUpperCase() !== 'PENDING') continue
      const pm = String(inv.payment_method || 'CRYPTO').toUpperCase()
      const q = pm === 'CARD' || pm === 'CARD_INTL' ? 'CARD' : pm === 'MIR' || pm === 'CARD_RU' ? 'MIR' : 'CRYPTO'
      return `/checkout/${encodeURIComponent(booking.id)}?pm=${q}`
    }
    return null
  }, [messages, booking, isHosting])

  // ── Archive ──────────────────────────────────────────────────────────────────
  const { archiveConversation } = useArchive({
    language, router, inbox,
    conversationId,
    basePath: '/renter/messages',
    userId: renterId,
  })

  // ── Send handlers ────────────────────────────────────────────────────────────
  const handleSendText = useCallback(async (e) => {
    e?.preventDefault()
    if (!newMessage.trim() || !selectedConv || !renterId) return
    const text = newMessage.trim()
    setNewMessage('')
    setSending(true)
    try {
      await _sendMessage(text, { skipPush: !!partnerOnline })
      inbox.refresh()
    } finally { setSending(false) }
  }, [newMessage, selectedConv, renterId, _sendMessage, partnerOnline, inbox])

  const handleSendVoice = useCallback(async () => {
    if (!voiceBlob || !renterId || !selectedConv) return
    setVoiceSending(true)
    try {
      const mime = voiceBlob.type || 'audio/webm'
      const ext = mime.includes('ogg') ? 'ogg' : mime.includes('mp4') ? 'm4a' : mime.includes('mpeg') ? 'mp3' : 'webm'
      const file = new File([voiceBlob], `voice_${Date.now()}.${ext}`, { type: mime })
      const { url: voiceUrl } = await uploadChatVoice(file, renterId)
      const res = await fetch('/api/v2/chat/messages', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConv.id,
          type: 'voice',
          content: '',
          metadata: { voice_url: voiceUrl, duration_sec: voiceDuration },
          skipPush: !!partnerOnline,
        }),
      })
      const json = await res.json()
      if (res.ok && json.success && json.data) {
        const mapped = mapApiMessageToRow(json.data, {
          viewerUserId: renterId,
          viewerRole: 'renter',
          bookingStatus: booking?.status ?? null,
          listingCategory: selectedConv?.listingCategory ?? null,
        })
        if (mapped) setMessages((prev) => [...prev, mapped])
        discardVoice()
        inbox.refresh()
      } else {
        toast.error(json.error || 'Ошибка отправки голосового')
      }
    } catch { toast.error('Ошибка сети') }
    finally { setVoiceSending(false) }
  }, [voiceBlob, renterId, selectedConv, voiceDuration, partnerOnline, booking?.status, setMessages, discardVoice, inbox])

  const handleAttachFile = useCallback(async (file) => {
    if (!selectedConv || !renterId) return
    setSending(true)
    try {
      await sendMedia(file, file.type.startsWith('image/') ? 'image' : 'file')
      inbox.refresh()
    } catch (err) {
      toast.error(err?.message || 'Не удалось загрузить файл')
    } finally { setSending(false) }
  }, [selectedConv, renterId, sendMedia, inbox])

  // ── Действия с бронью (хозяин на /renter/ — те же API, что и в партнёрском кабинете) ──
  const handleConfirmBooking = useCallback(async () => {
    const bid = booking?.id
    if (!bid || !selectedConv?.id || bookingActionLoading) return
    setBookingActionLoading(true)
    try {
      const res = await fetch(`/api/v2/partner/bookings/${encodeURIComponent(bid)}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CONFIRMED' }),
      })
      const json = await res.json()
      if (json.status !== 'success') { toast.error(json.error || 'Ошибка'); return }
      setBooking((b) => (b ? { ...b, status: 'CONFIRMED' } : b))
      inbox.refresh()
      reloadThread()
      toast.success(json.message || (language === 'ru' ? 'Бронирование подтверждено' : 'Booking confirmed'))
    } catch { toast.error('Ошибка сети') }
    finally { setBookingActionLoading(false) }
  }, [booking?.id, selectedConv?.id, bookingActionLoading, setBooking, inbox, reloadThread, language])

  const handleDeclineBooking = useCallback(() => {
    setDeclinePreset('occupied')
    setDeclineOtherDetail('')
    setDeclineOpen(true)
  }, [])

  const confirmDecline = useCallback(async () => {
    const bid = booking?.id
    if (!bid || !selectedConv?.id || bookingActionLoading) return
    if (declinePreset === 'other' && !declineOtherDetail.trim()) {
      toast.error(language === 'ru' ? 'Укажите комментарий' : 'Please add details')
      return
    }
    setBookingActionLoading(true)
    try {
      const res = await fetch(`/api/v2/partner/bookings/${encodeURIComponent(bid)}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'CANCELLED',
          declineReasonKey: declinePreset,
          declineReasonDetail: declinePreset === 'other' ? declineOtherDetail.trim() : '',
        }),
      })
      const json = await res.json()
      if (json.status !== 'success') { toast.error(json.error || 'Ошибка'); return }
      setBooking((b) => (b ? { ...b, status: 'CANCELLED' } : b))
      setDeclineOpen(false)
      inbox.refresh()
      reloadThread()
      toast.success(json.message || (language === 'ru' ? 'Бронирование отклонено' : 'Booking declined'))
    } catch { toast.error('Ошибка сети') }
    finally { setBookingActionLoading(false) }
  }, [booking?.id, selectedConv?.id, bookingActionLoading, declinePreset, declineOtherDetail, setBooking, inbox, reloadThread, language])

  const handleSendInvoice = useCallback(async (invoiceData) => {
    if (!selectedConv || !renterId) return
    try {
      const res = await fetch('/api/v2/chat/invoice', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConv.id,
          ...invoiceData,
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
        toast.success(language === 'ru' ? 'Счёт отправлен!' : 'Invoice sent!')
      } else {
        toast.error(data.error || 'Ошибка при отправке счёта')
      }
    } catch { toast.error('Ошибка при отправке счёта') }
  }, [selectedConv, renterId, booking, listing, setMessages, language])

  const handleSendPassportRequest = useCallback(async () => {
    if (!selectedConv || !renterId) return
    const res = await fetch('/api/v2/chat/messages', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: selectedConv.id,
        type: 'system',
        content: '',
        metadata: { system_key: 'passport_request' },
        skipPush: !!partnerOnline,
      }),
    })
    const json = await res.json()
    if (!res.ok || !json.success) throw new Error(json.error || 'Ошибка')
    if (json.data) setMessages((prev) => [...prev, json.data])
    inbox.refresh()
  }, [selectedConv, renterId, partnerOnline, setMessages, inbox])

  const handleComposerSendVoice = useCallback(async ({ url, duration }) => {
    if (!selectedConv || !renterId) return
    setSending(true)
    try {
      const res = await fetch('/api/v2/chat/messages', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConv.id,
          type: 'voice',
          content: '',
          metadata: { voice_url: url, duration_sec: duration },
          skipPush: !!partnerOnline,
        }),
      })
      const json = await res.json()
      if (res.ok && json.success && json.data) {
        const mapped = mapApiMessageToRow(json.data, {
          viewerUserId: renterId,
          viewerRole: 'renter',
          bookingStatus: booking?.status ?? null,
          listingCategory: selectedConv?.listingCategory ?? null,
        })
        if (mapped) setMessages((prev) => [...prev, mapped])
        inbox.refresh()
      } else {
        toast.error(json.error || 'Ошибка отправки голосового')
      }
    } catch { toast.error('Ошибка сети') }
    finally { setSending(false) }
  }, [selectedConv, renterId, partnerOnline, booking?.status, setMessages, inbox])

  // ── Вкладка инбокса с навигацией ─────────────────────────────────────────────
  const handleInboxTabChange = useCallback((next) => {
    inbox.setInboxTab(next)
    const list = inbox.conversations.filter((c) =>
      next === INBOX_TAB_HOSTING
        ? String(c.partnerId) === String(renterId)
        : String(c.renterId) === String(renterId)
    )
    if (conversationId && !list.some((c) => c.id === conversationId)) {
      if (list[0]) {
        const href = conversationMessagesHref(renterId, list[0]) || `/renter/messages/${list[0].id}`
        router.push(href)
      } else router.push('/renter/messages')
    }
  }, [inbox, conversationId, router, renterId])

  const handleConversationSelect = useCallback(
    (id, conv) => {
      const row = conv || inbox.filteredConversations.find((c) => c.id === id) || inbox.conversations.find((c) => c.id === id)
      const href = conversationMessagesHref(renterId, row || { id }) || `/renter/messages/${id}`
      router.push(href)
    },
    [router, renterId, inbox.filteredConversations, inbox.conversations]
  )

  // ── Loading / Auth states ────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    )
  }
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 gap-4">
        <p className="text-slate-600">{language === 'ru' ? 'Войдите, чтобы открыть сообщения' : 'Sign in to view messages'}</p>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => openLoginModal('login')}>
          {language === 'ru' ? 'Войти' : 'Sign In'}
        </Button>
      </div>
    )
  }

  // ── Slots ────────────────────────────────────────────────────────────────────

  const sidebarSlot = (
    <ConversationList
      inbox={{ ...inbox, setInboxTab: handleInboxTabChange }}
      selectedId={conversationId}
      onSelect={handleConversationSelect}
      categories={categories}
      showListingName
      showGuestName={inbox.inboxTab === INBOX_TAB_HOSTING}
      onArchive={(id) => void archiveConversation(id)}
      archivedHref="/renter/messages/archived"
      language={language}
    />
  )

  const headerSlot = selectedConv ? (
    <div className="flex items-center gap-1 px-2 py-1.5 lg:px-0 lg:py-0 bg-white border-b lg:border-0">
      <Button
        type="button" variant="outline" size="sm"
        className="shrink-0 text-slate-600 border-slate-200 hidden sm:inline-flex"
        onClick={() => void archiveConversation(selectedConv.id)}
      >
        <Archive className="h-4 w-4 sm:mr-1.5" />
        <span className="hidden md:inline">{language === 'ru' ? 'В архив' : 'Archive'}</span>
      </Button>
      <Link
        href="/renter/messages/archived"
        className="hidden lg:inline text-xs font-medium text-teal-700 hover:text-teal-900 underline underline-offset-2 shrink-0"
      >
        {language === 'ru' ? 'Архив' : 'Archive'}
      </Link>
      <div className="flex-1 min-w-0">
        <StickyChatHeader
          listing={listing}
          booking={booking}
          language={language}
          isAdminView={false}
          embedded compact
          messagesListHref={messagesListBase}
          showBookingTimeline={Boolean(booking?.id && booking?.status)}
          contactName={
            isHosting
              ? (selectedConv?.renterName || (language === 'ru' ? 'Гость' : 'Guest'))
              : (selectedConv?.partnerName || (language === 'ru' ? 'Партнёр' : 'Host'))
          }
          presenceOnline={partnerOnline}
          lastSeenAt={partnerLastSeenAt}
          typingIndicator={typingLine}
          typingGateWithPresence
          onMediaGallery={() => setMediaGalleryOpen(true)}
          onSearchToggle={() => { setSearchActive((v) => !v); setSearchQuery('') }}
          searchActive={searchActive}
          onDealInfoClick={() => setDealSheetOpen(true)}
          payNowHref={payNowHref}
          onSupportClick={() => setSupportDialogOpen(true)}
          supportPriorityActive={!!selectedConv?.isPriority}
          partnerBookingActions={{
            visible: isHosting && !!booking?.id && String(booking.status || '').toUpperCase() === 'PENDING',
            loading: bookingActionLoading,
            onConfirm: handleConfirmBooking,
            onDecline: handleDeclineBooking,
          }}
        >
          <span className={`flex items-center gap-1 text-xs ${isConnected ? 'text-green-600' : 'text-orange-500'}`}>
            {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {isConnected ? 'Live' : '…'}
          </span>
        </StickyChatHeader>
      </div>
    </div>
  ) : null

  const searchBarSlot = searchActive ? (
    <ChatSearchBar
      value={searchQuery}
      onChange={setSearchQuery}
      resultCount={searchQuery.trim() ? countSearchResults(messages, searchQuery) : null}
      onClose={() => { setSearchActive(false); setSearchQuery('') }}
      language={language}
    />
  ) : null

  const actionBarSlot = (
    <ChatActionBar
      isHosting={isHosting}
      isTraveling={isTraveling}
      booking={booking}
      payNowHref={payNowHref}
      onConfirm={isHosting ? handleConfirmBooking : undefined}
      onDecline={isHosting ? handleDeclineBooking : undefined}
      onOpenInvoice={isHosting ? () => setInvoiceDialogOpen(true) : undefined}
      loading={bookingActionLoading}
      language={language}
    />
  )

  const messagesSlot = (
    <>
      <ChatMediaGallery messages={messages} open={mediaGalleryOpen} onClose={() => setMediaGalleryOpen(false)} language={language} />

      {/* Промо-блок «Нужен транспорт?» при оплаченной брони */}
      {booking?.status === 'PAID' && String(listing?.category_id ?? listing?.categoryId) !== '2' && (
        <Card className="mx-2 mt-2 bg-gradient-to-r from-teal-50 to-blue-50 border-teal-200">
          <CardContent className="p-3 flex items-center gap-3">
            <span className="text-2xl">🏍️</span>
            <div className="flex-1">
              <p className="font-semibold text-slate-900 text-sm">{language === 'ru' ? 'Нужен транспорт?' : 'Need transport?'}</p>
              <p className="text-xs text-slate-600">{language === 'ru' ? 'Исследуйте наши байки и авто!' : 'Check our bikes & cars!'}</p>
            </div>
            <Button asChild size="sm" className="bg-teal-600 hover:bg-teal-700 shrink-0">
              <Link href="/?category=vehicles">{language === 'ru' ? 'Смотреть' : 'Browse'}</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* SafetyBanner — предупреждение о мошенниках */}
      <SafetyBanner
        patterns={detectedPatterns}
        onDismiss={() => setSafetyWarningShown(true)}
        lang={language}
      />

      {threadLoading ? (
        <div className="flex flex-1 items-center justify-center gap-3 py-12">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      ) : (
        <ChatMessageList
          messages={messages}
          userId={renterId}
          language={language}
          isBookingPaid={isBookingPaid(booking?.status)}
          searchHighlight={searchQuery.trim() || undefined}
          ownVariant="teal"
          userRole={isHosting ? 'partner' : 'renter'}
        />
      )}
    </>
  )

  // Composer: хозяин — PartnerChatComposer (счёт, паспорт, шаблоны); гость — прежний UI
  const composerSlot = isHosting ? (
    <PartnerChatComposer
      newMessage={newMessage}
      onMessageChange={(v) => { setNewMessage(v); broadcastTyping() }}
      onSubmit={handleSendText}
      sending={sending}
      disabled={!selectedConv}
      booking={booking}
      listing={listing}
      language={language}
      onSendInvoice={handleSendInvoice}
      onSendPassportRequest={handleSendPassportRequest}
      onAttachFile={handleAttachFile}
      onSendVoice={handleComposerSendVoice}
      userId={renterId}
      showHostPlusMenu
      invoiceDialogOpen={invoiceDialogOpen}
      onInvoiceDialogOpenChange={setInvoiceDialogOpen}
    />
  ) : (
    <div className={CHAT_COMPOSER_SHELL_CLASS}>
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
      <form
        onSubmit={handleSendText}
        className="flex w-full min-w-0 items-center gap-1.5 sm:gap-2"
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0 border-slate-200"
              disabled={sending}
              aria-label={language === 'ru' ? 'Вложения' : 'Attachments'}
            >
              <Plus className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem
              className="gap-2 cursor-pointer"
              onSelect={(e) => {
                e.preventDefault()
                attachFileRef.current?.click()
              }}
            >
              <Paperclip className="h-4 w-4 text-slate-600" />
              {language === 'ru' ? 'Фото или файл' : 'Photo or file'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {voiceBlob ? (
          <div className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-2 py-1.5 sm:px-3 sm:py-2">
            <div className="min-w-0 flex-1 overflow-hidden">
              <audio
                key={voicePreviewUrl || 'voice-preview'}
                src={voicePreviewUrl || undefined}
                controls
                playsInline
                preload="auto"
                className="block h-9 w-full max-w-full"
              />
            </div>
            <span className="text-xs text-teal-700 font-medium tabular-nums shrink-0">{voiceDurationLabel}</span>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50 shrink-0" onClick={discardVoice}>
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button type="button" disabled={voiceSending} className="h-8 px-3 bg-teal-600 hover:bg-teal-700 shrink-0" onClick={handleSendVoice}>
              {voiceSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        ) : voiceRecording ? (
          <div className="flex flex-1 min-w-0 items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span className="text-sm text-red-700 font-medium flex-1">{language === 'ru' ? 'Запись...' : 'Recording...'} {voiceDurationLabel}</span>
            <Button type="button" size="icon" className="h-8 w-8 bg-red-500 hover:bg-red-600 shrink-0" onClick={stopVoice}>
              <MicOff className="h-4 w-4 text-white" />
            </Button>
          </div>
        ) : (
          <>
            <div className="min-w-0 flex-1 flex items-center">
              <ChatGrowingTextarea
                value={newMessage}
                onChange={(v) => { setNewMessage(v); broadcastTyping() }}
                placeholder={getUIText('chatComposerPlaceholder', language)}
                disabled={sending}
                minHeightPx={44}
                className="min-h-[44px] py-3 text-[15px] leading-normal sm:text-sm"
              />
            </div>
            {!newMessage.trim() && (
              <Button
                type="button" variant="outline" size="icon"
                className="shrink-0 h-10 w-10 border-slate-200 text-slate-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                disabled={sending}
                onClick={startVoice}
                title={language === 'ru' ? 'Голосовое сообщение' : 'Voice message'}
              >
                <Mic className="h-4 w-4" />
              </Button>
            )}
            <Button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="bg-teal-600 hover:bg-teal-700 shrink-0 h-10 w-10 sm:w-auto sm:px-4"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </>
        )}
      </form>
    </div>
  )

  const dealDetailsPanel = selectedConv ? (
    <DealDetailsCard listing={listing} booking={booking} language={language} className="min-h-0" />
  ) : null

  const listingIdForCalendar = listing?.id ?? selectedConv?.listingId ?? null

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="min-h-screen bg-slate-50 flex flex-col">
        {/* Брендированная шапка (рентерский layout) */}
        <div className="bg-white border-b sticky top-0 z-10 shrink-0">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">GS</span>
              </div>
              <span className="font-bold text-slate-900">Gostaylo</span>
            </Link>
            <Button asChild variant="ghost" size="sm">
              <Link href="/"><Home className="h-4 w-4 mr-1.5" />{language === 'ru' ? 'Главная' : 'Home'}</Link>
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 w-full max-w-[1600px] mx-auto px-2 sm:px-4 py-4">
          <div className="flex w-full min-h-[min(72dvh,760px)] flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <ChatThreadChrome
              hasTread={!!conversationId}
              sidebarSlot={sidebarSlot}
              headerSlot={headerSlot}
              actionBarSlot={actionBarSlot}
              searchBarSlot={searchBarSlot}
              messagesSlot={messagesSlot}
              composerSlot={composerSlot}
              sidePanelSlot={dealDetailsPanel}
              language={language}
              className="w-full h-full"
            />
          </div>
        </div>
      </div>

      <PartnerChatCalendarPeek
        listingId={listingIdForCalendar}
        listingTitle={listing?.title}
        language={language}
        open={calendarOpen}
        onOpenChange={setCalendarOpen}
        triggerClassName="hidden lg:inline-flex"
      />

      {/* ── Диалог поддержки ──────────────────────────────────────────── */}
      <SupportRequestDialog
        open={supportDialogOpen}
        onOpenChange={setSupportDialogOpen}
        conversationId={selectedConv?.id}
        language={language}
        onSubmitted={() => {
          setSelectedConv((prev) => prev ? { ...prev, isPriority: true } : prev)
          reloadThread()
          inbox.refresh()
        }}
      />

      <Sheet open={dealSheetOpen} onOpenChange={setDealSheetOpen}>
        <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-2xl z-[210]">
          <SheetHeader className="text-left pb-2">
            <SheetTitle className="text-lg font-semibold text-slate-900">
              {language === 'ru' ? 'Детали сделки' : 'Deal details'}
            </SheetTitle>
          </SheetHeader>
          {dealDetailsPanel}
          <div className="lg:hidden border-t border-slate-200 pt-4 mt-4 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {language === 'ru' ? 'Инструменты' : 'Tools'}
            </p>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start gap-2 text-slate-800"
              onClick={() => {
                setDealSheetOpen(false)
                setSupportDialogOpen(true)
              }}
            >
              <LifeBuoy className="h-4 w-4 text-teal-600 shrink-0" />
              {language === 'ru' ? 'Помощь и поддержка' : 'Help & support'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start gap-2 text-slate-800"
              onClick={() => {
                setDealSheetOpen(false)
                setMediaGalleryOpen(true)
              }}
            >
              <Images className="h-4 w-4 text-teal-600 shrink-0" />
              {language === 'ru' ? 'Медиафайлы в чате' : 'Media in chat'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start gap-2 text-slate-800"
              onClick={() => {
                setDealSheetOpen(false)
                setSearchActive(true)
                setSearchQuery('')
              }}
            >
              <Search className="h-4 w-4 text-teal-600 shrink-0" />
              {language === 'ru' ? 'Поиск по сообщениям' : 'Search messages'}
            </Button>
            {isHosting && listingIdForCalendar ? (
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start gap-2 text-slate-800"
                onClick={() => {
                  setDealSheetOpen(false)
                  setCalendarOpen(true)
                }}
              >
                <Calendar className="h-4 w-4 text-teal-600 shrink-0" />
                {language === 'ru' ? 'Календарь занятости' : 'Availability calendar'}
              </Button>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{language === 'ru' ? 'Отклонить бронирование?' : 'Decline booking?'}</DialogTitle>
            <DialogDescription>
              {language === 'ru'
                ? 'Гость увидит уведомление в чате. По желанию укажите причину.'
                : 'The guest will see an update in chat. Optionally add a reason.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>{language === 'ru' ? 'Причина отказа' : 'Decline reason'}</Label>
            <RadioGroup value={declinePreset} onValueChange={setDeclinePreset} className="space-y-2">
              {['occupied', 'repair', 'other'].map((key) => (
                <label key={key} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50">
                  <RadioGroupItem value={key} id={`decline-r-${key}`} />
                  <span className="text-sm text-slate-800">
                    {language === 'ru' ? DECLINE_REASON_PRESETS[key].ru : DECLINE_REASON_PRESETS[key].en}
                  </span>
                </label>
              ))}
            </RadioGroup>
            {declinePreset === 'other' && (
              <div className="space-y-1">
                <Label htmlFor="decline-other-r">{language === 'ru' ? 'Комментарий' : 'Details'}</Label>
                <Textarea
                  id="decline-other-r"
                  value={declineOtherDetail}
                  onChange={(e) => setDeclineOtherDetail(e.target.value)}
                  rows={3}
                  placeholder={language === 'ru' ? 'Кратко опишите причину…' : 'Briefly describe the reason…'}
                  className="resize-none"
                />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDeclineOpen(false)}>
              {language === 'ru' ? 'Отмена' : 'Cancel'}
            </Button>
            <Button type="button" variant="destructive" disabled={bookingActionLoading} onClick={() => void confirmDecline()}>
              {bookingActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : language === 'ru' ? 'Отклонить' : 'Decline'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
