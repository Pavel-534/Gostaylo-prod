'use client'

/**
 * @file app/partner/messages/[id]/PartnerMessagesClient.jsx
 *
 * Client-компонент для страницы партнёрских сообщений.
 * Собирает все хуки фаз 1-3 и рендерит ChatThreadChrome.
 *
 * page.js → просто рендерит <PartnerMessagesClient params={params} />
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Archive, ArrowLeft, Loader2,
  Shield, Wifi, WifiOff,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

import { useI18n } from '@/contexts/i18n-context'
import { useChatContext } from '@/lib/context/ChatContext'

// ─── Хуки Фазы 2 ──────────────────────────────────────────────────────────────
import { useChatThreadMessages } from '@/hooks/use-chat-thread-messages'
import { useConversationInbox } from '@/hooks/use-conversation-inbox'

// ─── Инфраструктура Realtime / присутствие ────────────────────────────────────
import { usePresence } from '@/hooks/use-realtime-chat'
import { useMarkConversationRead } from '@/hooks/use-mark-conversation-read'
import { useChatTyping } from '@/hooks/use-chat-typing'

// ─── Компоненты Фазы 3 ────────────────────────────────────────────────────────
import { ChatThreadChrome } from '@/components/chat/ChatThreadChrome'
import { ChatMessageList } from '@/components/chat/ChatMessageList'
import { ConversationList } from '@/components/chat/ConversationList'

// ─── Существующие компоненты ──────────────────────────────────────────────────
import { StickyChatHeader } from '@/components/sticky-chat-header'
import { PartnerChatComposer } from '@/components/partner-chat-composer'
import { ChatActionBar } from '@/components/chat-action-bar'
import { ChatSearchBar } from '@/components/chat-search-bar'
import { ChatMediaGallery } from '@/components/chat-media-gallery'
import { SupportRequestDialog } from '@/components/support-request-dialog'
import { PartnerChatCalendarPeek } from '@/components/partner-chat-calendar-peek'
import { DECLINE_REASON_PRESETS } from '@/lib/booking-chat-copy'
import {
  INBOX_TAB_HOSTING,
  INBOX_TAB_TRAVELING,
} from '@/lib/chat-inbox-tabs'
import { isBookingPaid } from '@/lib/mask-contacts'
import { countSearchResults } from '@/lib/chat/message-filters'
import { conversationMessagesHref } from '@/components/chat/conversation-messages-href'
import { DealDetailsCard } from '@/components/chat/DealDetailsCard'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

// ─── Категории (загружаются один раз) ─────────────────────────────────────────
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

// ─── Auth для партнёра (manual fetch, совместимо с текущим page.js) ───────────
function usePartnerAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch('/api/v2/auth/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { if (d.success && d.user) setUser(d.user) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])
  return { user, loading }
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

export default function PartnerMessagesClient({ params }) {
  const router = useRouter()
  const { language } = useI18n()
  const { markConversationRead: markGlobalRead } = useChatContext()

  const conversationId = params?.id
  const { user, loading: authLoading } = usePartnerAuth()
  const categories = useCategories()

  // ── UI-стейт ────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('')
  const [searchActive, setSearchActive] = useState(false)
  const [mediaGalleryOpen, setMediaGalleryOpen] = useState(false)
  const [supportDialogOpen, setSupportDialogOpen] = useState(false)
  const [declineOpen, setDeclineOpen] = useState(false)
  const [declinePreset, setDeclinePreset] = useState('occupied')
  const [declineOtherDetail, setDeclineOtherDetail] = useState('')
  const [bookingActionLoading, setBookingActionLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false)
  const [dealSheetOpen, setDealSheetOpen] = useState(false)

  // ── Инбокс (Фаза 2) ─────────────────────────────────────────────────────────
  const inbox = useConversationInbox({
    userId: user?.id,
    defaultTab: INBOX_TAB_HOSTING,
    enabled: !!user?.id,
  })

  // ── Тред (Фаза 2) ───────────────────────────────────────────────────────────
  const {
    messages, isLoading: threadLoading, isConnected,
    selectedConv, listing, booking,
    sendMessage: _sendMessage, sendMedia,
    reload: reloadThread,
    setMessages, setBooking, setSelectedConv,
  } = useChatThreadMessages({
    conversationId,
    userId: user?.id,
    viewerRole: 'partner',
    onMarkRead: () => { if (conversationId) markGlobalRead(conversationId) },
    onNewMessage: () => {
      inbox.refresh()
      markNow()
    },
  })

  // Глобальный сброс при открытии треда
  useEffect(() => {
    if (conversationId) markGlobalRead(conversationId)
  }, [conversationId, markGlobalRead])

  // Синхронизируем вкладку инбокса с ролью в открытом диалоге
  useEffect(() => {
    if (!selectedConv?.id || !user?.id) return
    if (String(selectedConv.id) !== String(conversationId)) return
    const isHost = String(selectedConv.partnerId) === String(user.id)
    inbox.setInboxTab(isHost ? INBOX_TAB_HOSTING : INBOX_TAB_TRAVELING)
  }, [conversationId, selectedConv?.id, selectedConv?.partnerId, user?.id])

  // ── Роли в диалоге ──────────────────────────────────────────────────────────
  const isHosting = useMemo(
    () => !!(selectedConv?.id && user?.id && String(selectedConv.partnerId) === String(user.id)),
    [selectedConv, user]
  )
  const isTraveling = !isHosting

  const chatContactName = useMemo(() => {
    if (!selectedConv) return ''
    if (selectedConv.adminId) return selectedConv.adminName || 'Поддержка'
    if (String(selectedConv.partnerId) === String(user?.id)) {
      return selectedConv.renterName || (language === 'ru' ? 'Клиент' : 'Guest')
    }
    return selectedConv.partnerName || (language === 'ru' ? 'Хозяин' : 'Host')
  }, [selectedConv, user, language])

  const peerParticipantId = useMemo(() => {
    if (!selectedConv?.id || !user?.id) return null
    if (selectedConv.adminId) return selectedConv.adminId
    if (String(selectedConv.partnerId) === String(user.id)) return selectedConv.renterId
    return selectedConv.partnerId
  }, [selectedConv, user])

  // ── Presence / Typing ────────────────────────────────────────────────────────
  const { isOnline: peerOnline } = usePresence(conversationId, user?.id, peerParticipantId)

  const [peerLastSeenAt, setPeerLastSeenAt] = useState(null)
  const peerOnlinePrevRef = useRef(null)
  useEffect(() => {
    if (peerOnlinePrevRef.current === true && peerOnline === false) {
      setPeerLastSeenAt(new Date().toISOString())
    }
    peerOnlinePrevRef.current = peerOnline
  }, [peerOnline])

  const { markNow } = useMarkConversationRead(conversationId, !!(conversationId && user?.id), peerOnline)

  const partnerDisplayName = useMemo(() => {
    if (!user) return 'Partner'
    const n = [user.first_name, user.last_name].filter(Boolean).join(' ').trim()
    return n || user.name || user.email || 'Partner'
  }, [user])

  const { peerTypingName, broadcastTyping } = useChatTyping(conversationId, user?.id, partnerDisplayName)

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
    basePath: '/partner/messages',
    userId: user?.id,
  })

  // ── Booking actions (Confirm / Decline) ─────────────────────────────────────
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
      setBooking((b) => b ? { ...b, status: 'CONFIRMED' } : b)
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
      setBooking((b) => b ? { ...b, status: 'CANCELLED' } : b)
      setDeclineOpen(false)
      inbox.refresh()
      reloadThread()
      toast.success(json.message || (language === 'ru' ? 'Бронирование отклонено' : 'Booking declined'))
    } catch { toast.error('Ошибка сети') }
    finally { setBookingActionLoading(false) }
  }, [booking?.id, selectedConv?.id, bookingActionLoading, declinePreset, declineOtherDetail, setBooking, inbox, reloadThread, language])

  // ── Send handlers ────────────────────────────────────────────────────────────
  const handleSendText = useCallback(async (e) => {
    e?.preventDefault()
    if (!newMessage.trim() || !selectedConv || !user) return
    const text = newMessage.trim()
    setNewMessage('')
    setSending(true)
    try {
      await _sendMessage(text, { skipPush: !!peerOnline })
      inbox.refresh()
    } finally { setSending(false) }
  }, [newMessage, selectedConv, user, _sendMessage, peerOnline, inbox])

  const handleSendVoice = useCallback(async ({ url, duration }) => {
    if (!selectedConv || !user) return
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
          skipPush: !!peerOnline,
        }),
      })
      const json = await res.json()
      if (res.ok && json.success && json.data) {
        setMessages((prev) => [...prev, json.data])
        inbox.refresh()
      } else {
        toast.error(json.error || 'Ошибка отправки голосового')
      }
    } catch { toast.error('Ошибка сети') }
    finally { setSending(false) }
  }, [selectedConv, user, peerOnline, setMessages, inbox])

  const handleSendInvoice = useCallback(async (invoiceData) => {
    if (!selectedConv || !user) return
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
  }, [selectedConv, user, booking, listing, setMessages, language])

  const handleSendPassportRequest = useCallback(async () => {
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
    if (!res.ok || !json.success) throw new Error(json.error || 'Ошибка')
    if (json.data) setMessages((prev) => [...prev, json.data])
    inbox.refresh()
  }, [selectedConv, user, peerOnline, setMessages, inbox])

  const handleAttachFile = useCallback(async (file) => {
    if (!selectedConv || !user) return
    try {
      await sendMedia(file, file.type.startsWith('image/') ? 'image' : 'file')
      inbox.refresh()
    } catch (err) {
      toast.error(err?.message || 'Не удалось загрузить файл')
    }
  }, [selectedConv, user, sendMedia, inbox])

  // ── Обработчик вкладки инбокса — с навигацией ────────────────────────────────
  const handleInboxTabChange = useCallback((next) => {
    inbox.setInboxTab(next)
    const list = inbox.conversations.filter((c) =>
      next === INBOX_TAB_HOSTING
        ? String(c.partnerId) === String(user?.id)
        : String(c.renterId) === String(user?.id)
    )
    if (conversationId && !list.some((c) => c.id === conversationId)) {
      if (list[0]) {
        const href = conversationMessagesHref(user?.id, list[0]) || `/partner/messages/${list[0].id}`
        router.push(href)
      } else router.push('/partner/messages')
    }
  }, [inbox, conversationId, router, user?.id])

  const handleConversationSelect = useCallback(
    (id, conv) => {
      const row = conv || inbox.filteredConversations.find((c) => c.id === id) || inbox.conversations.find((c) => c.id === id)
      const href = conversationMessagesHref(user?.id, row || { id }) || `/partner/messages/${id}`
      router.push(href)
    },
    [router, user?.id, inbox.filteredConversations, inbox.conversations]
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
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-slate-600 mb-4">Требуется авторизация</p>
      </div>
    )
  }

  // ── Slots для ChatThreadChrome ────────────────────────────────────────────────

  // Sidebar
  const sidebarSlot = (
    <ConversationList
      inbox={{ ...inbox, setInboxTab: handleInboxTabChange }}
      selectedId={conversationId}
      onSelect={handleConversationSelect}
      categories={categories}
      showListingName={false}
      showGuestName={inbox.inboxTab === INBOX_TAB_TRAVELING}
      onArchive={(id) => void archiveConversation(id)}
      archivedHref="/partner/messages/archived"
      language={language}
    />
  )

  // Header
  const headerSlot = selectedConv ? (
    <div className="flex items-center gap-1 px-2 py-1.5 lg:px-0 lg:py-0 bg-white border-b lg:border-0">
      <Button variant="ghost" size="icon" className="lg:hidden shrink-0" onClick={() => router.push('/partner/messages')}>
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <Button
        type="button" variant="outline" size="sm"
        className="shrink-0 text-slate-600 border-slate-200 hidden sm:inline-flex"
        onClick={() => void archiveConversation(selectedConv.id)}
      >
        <Archive className="h-4 w-4 sm:mr-1.5" />
        <span className="hidden md:inline">{language === 'ru' ? 'В архив' : 'Archive'}</span>
      </Button>
      <div className="flex-1 min-w-0">
        <StickyChatHeader
          listing={listing}
          booking={booking}
          language={language}
          isAdminView={false}
          embedded compact
          showBookingTimeline={Boolean(booking?.id && booking?.status)}
          contactName={chatContactName}
          presenceOnline={peerParticipantId ? peerOnline : null}
          lastSeenAt={peerLastSeenAt}
          typingIndicator={typingLine}
          typingGateWithPresence
          onMediaGallery={() => setMediaGalleryOpen(true)}
          onSearchToggle={() => { setSearchActive((v) => !v); setSearchQuery('') }}
          searchActive={searchActive}
          onDealInfoClick={() => setDealSheetOpen(true)}
          partnerBookingActions={{
            visible: isHosting && !!booking?.id && String(booking.status || '').toUpperCase() === 'PENDING',
            loading: bookingActionLoading,
            onConfirm: handleConfirmBooking,
            onDecline: handleDeclineBooking,
          }}
          payNowHref={isHosting ? null : payNowHref}
          onSupportClick={() => setSupportDialogOpen(true)}
          supportPriorityActive={!!selectedConv?.isPriority}
        >
          {isHosting && (
            <div className="flex items-center gap-2">
              <PartnerChatCalendarPeek listingId={listing?.id} listingTitle={listing?.title} language={language} />
              <span className={`flex items-center gap-1 text-xs ${isConnected ? 'text-green-600' : 'text-orange-500'}`}>
                {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {isConnected ? 'Live' : '…'}
              </span>
            </div>
          )}
        </StickyChatHeader>
      </div>
    </div>
  ) : null

  // Search bar
  const searchBarSlot = searchActive ? (
    <ChatSearchBar
      value={searchQuery}
      onChange={setSearchQuery}
      resultCount={searchQuery.trim() ? countSearchResults(messages, searchQuery) : null}
      onClose={() => { setSearchActive(false); setSearchQuery('') }}
      language={language}
    />
  ) : null

  // Action bar
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

  // Messages
  const messagesSlot = (
    <>
      <ChatMediaGallery messages={messages} open={mediaGalleryOpen} onClose={() => setMediaGalleryOpen(false)} language={language} />
      {threadLoading ? (
        <div className="flex flex-1 items-center justify-center gap-3 py-12">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      ) : (
        <ChatMessageList
          messages={messages}
          userId={user?.id}
          language={language}
          isBookingPaid={isBookingPaid(booking?.status)}
          searchHighlight={searchQuery.trim() || undefined}
          ownVariant="teal"
          userRole="partner"
          onInvoiceCancelled={(msgId) => {
            setMessages((prev) => prev.map((m) =>
              m.id === msgId
                ? { ...m, metadata: { ...m.metadata, invoice: { ...m.metadata?.invoice, status: 'CANCELLED' } } }
                : m
            ))
          }}
        />
      )}
    </>
  )

  // Composer
  const composerSlot = (
    <PartnerChatComposer
      newMessage={newMessage}
      onMessageChange={(v) => { setNewMessage(v); broadcastTyping() }}
      onSubmit={handleSendText}
      sending={sending}
      disabled={!selectedConv}
      booking={booking}
      listing={listing}
      language={language}
      onSendInvoice={isHosting ? handleSendInvoice : undefined}
      onSendPassportRequest={isHosting ? handleSendPassportRequest : undefined}
      onAttachFile={handleAttachFile}
      onSendVoice={handleSendVoice}
      userId={user?.id}
      showHostPlusMenu={isHosting}
      invoiceDialogOpen={invoiceDialogOpen}
      onInvoiceDialogOpenChange={setInvoiceDialogOpen}
    />
  )

  const dealDetailsPanel = selectedConv ? (
    <DealDetailsCard listing={listing} booking={booking} language={language} className="min-h-0" />
  ) : null

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
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
        className="h-[calc(100vh-4rem)]"
      />

      <Sheet open={dealSheetOpen} onOpenChange={setDealSheetOpen}>
        <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-2xl z-[210]">
          <SheetHeader className="text-left pb-2">
            <SheetTitle className="text-base font-semibold">
              {language === 'ru' ? 'Детали поездки' : 'Trip details'}
            </SheetTitle>
          </SheetHeader>
          {dealDetailsPanel}
        </SheetContent>
      </Sheet>

      {/* ── Диалог отклонения бронирования ────────────────────────────── */}
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
                  <RadioGroupItem value={key} id={`decline-${key}`} />
                  <span className="text-sm text-slate-800">
                    {language === 'ru' ? DECLINE_REASON_PRESETS[key].ru : DECLINE_REASON_PRESETS[key].en}
                  </span>
                </label>
              ))}
            </RadioGroup>
            {declinePreset === 'other' && (
              <div className="space-y-1">
                <Label htmlFor="decline-other">{language === 'ru' ? 'Комментарий' : 'Details'}</Label>
                <Textarea
                  id="decline-other"
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

      {/* ── Диалог поддержки ──────────────────────────────────────────────── */}
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
    </>
  )
}
