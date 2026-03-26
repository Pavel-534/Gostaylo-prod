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
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Archive, ArrowLeft, Loader2, Home,
  Mic, MicOff, Paperclip, Send,
  Wifi, WifiOff, Trash2,
} from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ChatGrowingTextarea } from '@/components/chat-growing-textarea'

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
import { SupportRequestDialog } from '@/components/support-request-dialog'
import { detectUnsafePatterns, SafetyBanner } from '@/components/chat-safety'
import { uploadChatFile } from '@/lib/chat-upload'
import {
  INBOX_TAB_HOSTING,
  INBOX_TAB_TRAVELING,
  consumeRenterInboxTabPreference,
} from '@/lib/chat-inbox-tabs'
import { isBookingPaid } from '@/lib/mask-contacts'
import { countSearchResults } from '@/lib/chat/message-filters'

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
function useArchive({ language, router, inbox, conversationId, basePath }) {
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
        if (remaining[0]) router.push(`${basePath}/${remaining[0].id}`)
        else router.push(basePath)
      }
    } catch {
      toast.error(language === 'ru' ? 'Ошибка сети' : 'Network error')
    }
  }, [language, router, inbox, conversationId, basePath])

  return { archiveConversation }
}

// ─── Главный компонент ────────────────────────────────────────────────────────

export default function RenterMessagesClient({ params }) {
  const router = useRouter()
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
    setMessages, setSelectedConv,
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

  // Синхронизация вкладки
  useEffect(() => {
    if (!conversationId || !selectedConv?.id || !renterId) return
    if (String(selectedConv.id) !== String(conversationId)) return
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

  // ── Presence / Typing ────────────────────────────────────────────────────────
  const partnerPeerId = selectedConv?.partnerId || selectedConv?.adminId || null
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
      const voiceUrl = await uploadChatFile(voiceBlob, { folder: 'voice', fileName: `voice_${Date.now()}.webm` })
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
        setMessages((prev) => [...prev, json.data])
        discardVoice()
        inbox.refresh()
      } else {
        toast.error(json.error || 'Ошибка отправки голосового')
      }
    } catch { toast.error('Ошибка сети') }
    finally { setVoiceSending(false) }
  }, [voiceBlob, renterId, selectedConv, voiceDuration, partnerOnline, setMessages, discardVoice, inbox])

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

  // ── Вкладка инбокса с навигацией ─────────────────────────────────────────────
  const handleInboxTabChange = useCallback((next) => {
    inbox.setInboxTab(next)
    const list = inbox.conversations.filter((c) =>
      next === INBOX_TAB_HOSTING
        ? String(c.partnerId) === String(renterId)
        : String(c.renterId) === String(renterId)
    )
    if (conversationId && !list.some((c) => c.id === conversationId)) {
      if (list[0]) router.push(`/renter/messages/${list[0].id}`)
      else router.push('/renter/messages')
    }
  }, [inbox, conversationId, router, renterId])

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
      onSelect={(id) => router.push(`/renter/messages/${id}`)}
      categories={categories}
      showListingName
      showGuestName={false}
      onArchive={(id) => void archiveConversation(id)}
      archivedHref="/renter/messages/archived"
      language={language}
    />
  )

  const headerSlot = selectedConv ? (
    <div className="flex items-center gap-1 px-2 py-1.5 lg:px-0 lg:py-0 bg-white border-b lg:border-0">
      <Button variant="ghost" size="icon" className="lg:hidden shrink-0" onClick={() => router.push('/renter/messages')}
        aria-label={language === 'ru' ? 'К списку диалогов' : 'Back to conversations'}>
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
          showBookingTimeline={Boolean(booking?.id && booking?.status)}
          contactName={selectedConv?.partnerName || (language === 'ru' ? 'Партнёр' : 'Host')}
          presenceOnline={partnerOnline}
          lastSeenAt={partnerLastSeenAt}
          typingIndicator={typingLine}
          typingGateWithPresence
          onMediaGallery={() => setMediaGalleryOpen(true)}
          onSearchToggle={() => { setSearchActive((v) => !v); setSearchQuery('') }}
          searchActive={searchActive}
          payNowHref={payNowHref}
          onSupportClick={() => setSupportDialogOpen(true)}
          supportPriorityActive={!!selectedConv?.isPriority}
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
          userRole="renter"
        />
      )}
    </>
  )

  // Composer рентера: ChatGrowingTextarea + голос + файл
  const composerSlot = (
    <div className="shrink-0 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
      <form onSubmit={handleSendText} className="flex gap-2 items-end">
        <Button
          type="button" variant="outline" size="icon"
          className="flex-shrink-0 border-slate-200 h-10 w-10"
          disabled={sending}
          aria-label={language === 'ru' ? 'Прикрепить файл' : 'Attach file'}
          onClick={() => attachFileRef.current?.click()}
        >
          <Paperclip className="h-5 w-5" />
        </Button>

        {/* Предпросмотр голосового */}
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
            <span className="text-sm text-red-700 font-medium flex-1">{language === 'ru' ? 'Запись...' : 'Recording...'} {voiceDurationLabel}</span>
            <Button type="button" size="icon" className="h-8 w-8 bg-red-500 hover:bg-red-600 shrink-0" onClick={stopVoice}>
              <MicOff className="h-4 w-4 text-white" />
            </Button>
          </div>
        ) : (
          <>
            <ChatGrowingTextarea
              value={newMessage}
              onChange={(v) => { setNewMessage(v); broadcastTyping() }}
              placeholder={getUIText('chatComposerPlaceholder', language)}
              disabled={sending}
            />
            {!newMessage.trim() && (
              <Button
                type="button" variant="outline" size="icon"
                className="flex-shrink-0 h-10 w-10 border-slate-200 text-slate-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600"
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
              className="bg-teal-600 hover:bg-teal-700 flex-shrink-0 h-10 w-10 sm:w-auto sm:px-4"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </>
        )}
      </form>
    </div>
  )

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
              language={language}
              className="w-full h-full"
            />
          </div>
        </div>
      </div>

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
    </>
  )
}
