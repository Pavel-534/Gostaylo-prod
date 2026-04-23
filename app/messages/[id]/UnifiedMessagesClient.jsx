'use client'

/**
 * @file app/messages/[id]/UnifiedMessagesClient.jsx
 * Единый тред: роль по аккаунту, инструменты хозяина по isHosting.
 * Модульная оболочка: контекст `MessengerThreadProvider`, UI — `app/messages/[id]/components/`.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import nextDynamic from 'next/dynamic'
import { toast } from 'sonner'
import { Archive, Loader2, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { detectUnsafePatterns, SafetyBanner } from '@/components/chat-safety'
import { uploadChatVoice } from '@/lib/chat-upload'
import { cn } from '@/lib/utils'
import { formatPrivacyDisplayNameForParticipant } from '@/lib/utils/name-formatter'
import { useVoiceRecorder } from '@/hooks/use-voice-recorder'
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
import { useChatThreadMessages } from '@/hooks/use-chat-thread-messages'
import { useConversationInbox } from '@/hooks/use-conversation-inbox'
import { usePresenceContext } from '@/lib/context/PresenceContext'
import { useMarkConversationRead } from '@/hooks/use-mark-conversation-read'
import { useChatTyping } from '@/hooks/use-chat-typing'
import { ChatThreadChrome } from '@/components/chat/ChatThreadChrome'
import { RealtimeDiagOverlay } from '@/components/chat/RealtimeDiagOverlay'
import { StickyChatHeader } from '@/components/sticky-chat-header'
import { ChatActionBar } from '@/components/chat-action-bar'
import { ChatSearchBar } from '@/components/chat-search-bar'
import { SupportRequestDialog } from '@/components/support-request-dialog'
import {
  INBOX_TAB_HOSTING,
  INBOX_TAB_TRAVELING,
  consumeRenterInboxTabPreference,
} from '@/lib/chat-inbox-tabs'
import { isBookingPaid } from '@/lib/mask-contacts'
import { countSearchResults } from '@/lib/chat/message-filters'
import { mapApiMessageToRow } from '@/lib/chat/map-api-message'
import { useThreadArchive } from './hooks/useThreadArchive'
import { MessengerThreadProvider } from './context/ChatContext'
import { ConversationSidebar } from './components/ConversationSidebar'
import { MessageList } from './components/MessageList'
import { MessageInput } from './components/MessageInput'
import { BookingInfoSidebar } from './components/BookingInfoSidebar'
import { ThreadDealDetailsSheet } from './components/ThreadDealDetailsSheet'
import { DeclineBookingDialog } from './components/DeclineBookingDialog'

const PartnerChatCalendarPeek = nextDynamic(
  () => import('@/components/partner-chat-calendar-peek').then((m) => m.PartnerChatCalendarPeek),
  { ssr: false, loading: () => null },
)

export default function UnifiedMessagesClient({ params }) {
  const router = useRouter()
  const { language } = useI18n()
  const { user, loading: authLoading, openLoginModal } = useAuth()
  const { markConversationRead: markGlobalRead, typingByConversation } = useChatContext()

  const conversationId = params?.id
  const bookingMutationRef = useRef(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchActive, setSearchActive] = useState(false)
  const [mediaGalleryOpen, setMediaGalleryOpen] = useState(false)
  const [supportDialogOpen, setSupportDialogOpen] = useState(false)
  const [declineOpen, setDeclineOpen] = useState(false)
  const [declinePreset, setDeclinePreset] = useState('occupied')
  const [declineOtherDetail, setDeclineOtherDetail] = useState('')
  const [payBarSuppressed, setPayBarSuppressed] = useState(false)
  const [sending, setSending] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false)
  const [dealSheetOpen, setDealSheetOpen] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [voiceSending, setVoiceSending] = useState(false)
  const [safetyWarningShown, setSafetyWarningShown] = useState(false)
  const [detectedPatterns, setDetectedPatterns] = useState([])

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

  const isPartnerAccount = useMemo(() => {
    const r = String(user?.role || '').toUpperCase()
    return ['PARTNER', 'ADMIN', 'MODERATOR'].includes(r)
  }, [user?.role])

  const viewerRoleForHook = useMemo(
    () => (isPartnerAccount ? 'partner' : 'renter'),
    [isPartnerAccount],
  )

  const inbox = useConversationInbox({
    userId: user?.id,
    defaultTab: isPartnerAccount ? INBOX_TAB_HOSTING : INBOX_TAB_TRAVELING,
    enabled: !!user?.id,
  })

  useEffect(() => {
    if (!user?.id || isPartnerAccount) return
    const p = consumeRenterInboxTabPreference()
    if (p) inbox.setInboxTab(p)
  }, [user?.id, isPartnerAccount, inbox.setInboxTab])

  const clearInboxUnreadForConv = useCallback(
    (cid) => {
      if (!cid) return
      inbox.setConversations((prev) =>
        prev.map((c) =>
          String(c.id) === String(cid) ? { ...c, unreadCount: 0 } : c,
        ),
      )
    },
    [inbox.setConversations],
  )

  const {
    messages,
    isLoading: threadLoading,
    isConnected: isRealtimeConnected,
    selectedConv,
    listing,
    booking,
    sendMessage: sendMessageText,
    sendMedia,
    reload: reloadThread,
    setMessages,
    setBooking,
    setSelectedConv,
  } = useChatThreadMessages({
    conversationId,
    userId: user?.id,
    viewerRole: viewerRoleForHook,
    onMarkRead: () => {
      if (conversationId) {
        markGlobalRead(conversationId)
        clearInboxUnreadForConv(conversationId)
      }
    },
    onNewMessage: () => {
      inbox.refresh()
      markNow()
    },
  })

  useEffect(() => {
    if (conversationId) {
      markGlobalRead(conversationId)
      clearInboxUnreadForConv(conversationId)
    }
  }, [conversationId, markGlobalRead, clearInboxUnreadForConv])

  useEffect(() => {
    setPayBarSuppressed(false)
  }, [conversationId, booking?.id])

  const tabSyncedForConvRef = useRef(null)
  useEffect(() => {
    tabSyncedForConvRef.current = null
  }, [conversationId])
  useEffect(() => {
    if (!conversationId || !user?.id) return
    if (!selectedConv?.id || String(selectedConv.id) !== String(conversationId)) return
    if (tabSyncedForConvRef.current === conversationId) return
    tabSyncedForConvRef.current = conversationId
    const uid = String(user.id)
    const isHost =
      String(selectedConv.partnerId) === uid || String(selectedConv.ownerId) === uid
    inbox.setInboxTab(isHost ? INBOX_TAB_HOSTING : INBOX_TAB_TRAVELING)
  }, [conversationId, selectedConv?.id, selectedConv?.partnerId, selectedConv?.ownerId, user?.id, inbox.setInboxTab])

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

  const isHosting = useMemo(() => {
    if (!selectedConv?.id || !user?.id) return false
    const uid = String(user.id)
    return String(selectedConv.partnerId) === uid || String(selectedConv.ownerId) === uid
  }, [selectedConv, user])

  const isTraveling = !isHosting
  const inboxListHref = '/messages/'
  const archivedHallHref = '/messages/archived/'

  const conversationForMapper = useMemo(() => {
    if (!selectedConv) return null
    return {
      renterId: selectedConv.renterId,
      renter_id: selectedConv.renterId,
      partnerId: selectedConv.partnerId,
      partner_id: selectedConv.partnerId,
      ownerId: selectedConv.ownerId,
      owner_id: selectedConv.ownerId,
    }
  }, [selectedConv])

  const chatContactName = useMemo(() => {
    if (!selectedConv) return ''
    if (selectedConv.adminId) {
      return selectedConv.adminName || getUIText('messengerThread_labelSupport', language)
    }
    if (String(selectedConv.partnerId) === String(user?.id)) {
      return selectedConv.renterName || getUIText('messengerThread_labelGuest', language)
    }
    return selectedConv.partnerName || getUIText('messengerThread_labelHost', language)
  }, [selectedConv, user, language])

  const peerParticipantId = useMemo(() => {
    if (!selectedConv?.id || !user?.id) return null
    if (selectedConv.adminId) return selectedConv.adminId
    if (String(selectedConv.partnerId) === String(user.id)) return selectedConv.renterId
    return selectedConv.partnerId ?? selectedConv.ownerId ?? null
  }, [selectedConv, user])

  const persistedPeerLastSeenAt = useMemo(() => {
    if (!selectedConv?.id || !peerParticipantId) return null
    if (selectedConv.adminId && String(selectedConv.adminId) === String(peerParticipantId)) {
      return selectedConv.adminLastSeenAt ?? selectedConv.admin_last_seen_at ?? null
    }
    if (String(selectedConv.renterId || '') === String(peerParticipantId)) {
      return selectedConv.renterLastSeenAt ?? selectedConv.renter_last_seen_at ?? null
    }
    return selectedConv.partnerLastSeenAt ?? selectedConv.partner_last_seen_at ?? null
  }, [selectedConv, peerParticipantId])

  const { isUserOnline } = usePresenceContext()
  const peerOnline = useMemo(() => isUserOnline(peerParticipantId), [isUserOnline, peerParticipantId])
  const [peerLastSeenAt, setPeerLastSeenAt] = useState(null)
  useEffect(() => {
    setPeerLastSeenAt(persistedPeerLastSeenAt || null)
  }, [persistedPeerLastSeenAt, conversationId])
  const peerOnlinePrevRef = useRef(null)
  useEffect(() => {
    if (peerOnlinePrevRef.current === true && peerOnline === false) {
      setPeerLastSeenAt(new Date().toISOString())
    }
    peerOnlinePrevRef.current = peerOnline
  }, [peerOnline])

  const { markNow } = useMarkConversationRead(conversationId, !!(conversationId && user?.id), peerOnline)

  const unifiedDisplayName = useMemo(
    () =>
      formatPrivacyDisplayNameForParticipant(
        user?.first_name,
        user?.last_name,
        user?.email,
        getUIText('adminGuestLabel', language),
      ),
    [user, language],
  )

  const { broadcastTyping, broadcastTypingStop } = useChatTyping(
    conversationId,
    user?.id,
    unifiedDisplayName,
  )

  const peerTypingName = useMemo(() => {
    const t = typingByConversation?.[String(conversationId || '')]
    return t?.name || null
  }, [typingByConversation, conversationId])

  const typingLine = useMemo(() => {
    if (!peerTypingName) return null
    return getUIText('messengerThread_typingByName', language).replace(
      '{{name}}',
      peerTypingName,
    )
  }, [peerTypingName, language])

  const payNowHref = useMemo(() => {
    if (isHosting || !booking?.id) return null
    const st = String(booking.status || '').toUpperCase()
    if (['CANCELLED', 'REFUNDED', 'COMPLETED', 'PAID', 'PAID_ESCROW'].includes(st)) return null
    if (st !== 'CONFIRMED') return null
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

  const { archiveConversation } = useThreadArchive({
    language,
    router,
    inbox,
    conversationId,
    inboxListHref,
    archivedListHref: archivedHallHref,
  })

  const handleConfirmBooking = useCallback(async () => {
    const bid = booking?.id
    if (!bid || !selectedConv?.id || bookingMutationRef.current) return
    const st = String(booking?.status || '').toUpperCase()
    if (st !== 'PENDING' && st !== 'INQUIRY') return
    bookingMutationRef.current = true
    const prevBooking = booking
    setBooking((b) => (b ? { ...b, status: 'CONFIRMED' } : b))
    try {
      const res = await fetch(`/api/v2/partner/bookings/${encodeURIComponent(bid)}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CONFIRMED' }),
      })
      const json = await res.json()
      if (json.status !== 'success') {
        setBooking(prevBooking)
        toast.error(json.error || getUIText('chatPartner_toastBookingConfirmError', language))
        return
      }
      inbox.refresh()
      reloadThread()
      toast.success(
        json.message || getUIText('chatPartner_toastBookingConfirmed', language),
      )
    } catch {
      setBooking(prevBooking)
      toast.error(getUIText('listingDetail_networkError', language))
    } finally {
      bookingMutationRef.current = false
    }
  }, [booking, selectedConv?.id, setBooking, inbox, reloadThread, language])

  const handleDeclineBooking = useCallback(() => {
    setDeclinePreset('occupied')
    setDeclineOtherDetail('')
    setDeclineOpen(true)
  }, [])

  const confirmDecline = useCallback(async () => {
    const bid = booking?.id
    if (!bid || !selectedConv?.id || bookingMutationRef.current) return
    const st = String(booking?.status || '').toUpperCase()
    if (st !== 'PENDING' && st !== 'INQUIRY') return
    if (declinePreset === 'other' && !declineOtherDetail.trim()) {
      toast.error(getUIText('messengerThread_declineOtherRequired', language))
      return
    }
    bookingMutationRef.current = true
    const prevBooking = booking
    setBooking((b) => (b ? { ...b, status: 'CANCELLED' } : b))
    setDeclineOpen(false)
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
      if (json.status !== 'success') {
        setBooking(prevBooking)
        setDeclineOpen(true)
        toast.error(json.error || getUIText('chatPartner_toastBookingDeclineError', language))
        return
      }
      inbox.refresh()
      reloadThread()
      toast.success(
        json.message || getUIText('chatPartner_toastBookingDeclined', language),
      )
    } catch {
      setBooking(prevBooking)
      setDeclineOpen(true)
      toast.error(getUIText('listingDetail_networkError', language))
    } finally {
      bookingMutationRef.current = false
    }
  }, [booking, selectedConv?.id, declinePreset, declineOtherDetail, setBooking, inbox, reloadThread, language])

  const partnerInquiryActionsForMilestone = useMemo(() => {
    if (!isHosting || !booking?.id) return null
    const st = String(booking.status || '').toUpperCase()
    if (st !== 'PENDING' && st !== 'INQUIRY') return null
    return {
      onConfirm: handleConfirmBooking,
      onDecline: handleDeclineBooking,
      loading: false,
    }
  }, [isHosting, booking?.id, booking?.status, handleConfirmBooking, handleDeclineBooking])

  const handleSendText = useCallback(
    async (e) => {
      e?.preventDefault()
      if (!newMessage.trim() || !selectedConv || !user) return
      broadcastTypingStop()
      const text = newMessage.trim()
      setNewMessage('')
      setSending(true)
      try {
        await sendMessageText(text)
        inbox.refresh()
      } finally {
        setSending(false)
      }
    },
    [newMessage, selectedConv, user, sendMessageText, inbox, broadcastTypingStop],
  )

  const handleSendVoice = useCallback(
    async ({ url, duration }) => {
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
          }),
        })
        const json = await res.json()
        if (res.ok && json.success && json.data) {
          const mapped = mapApiMessageToRow(json.data, {
            viewerUserId: user.id,
            viewerRole: viewerRoleForHook,
            bookingStatus: booking?.status ?? null,
            listingCategory: selectedConv?.listingCategory ?? null,
            conversation: conversationForMapper,
          })
          if (mapped) setMessages((prev) => [...prev, mapped])
          inbox.refresh()
        } else {
          toast.error(json.error || getUIText('listingDetail_networkError', language))
        }
      } catch {
        toast.error(getUIText('listingDetail_networkError', language))
      } finally {
        setSending(false)
      }
    },
    [selectedConv, user, booking?.status, setMessages, inbox, viewerRoleForHook, conversationForMapper, language],
  )

  const handleSendInvoice = useCallback(
    async (invoiceData) => {
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
          toast.success(getUIText('messengerThread_invoiceSent', language))
        } else {
          toast.error(data.error || getUIText('messengerThread_invoiceError', language))
        }
      } catch {
        toast.error(getUIText('messengerThread_invoiceError', language))
      }
    },
    [selectedConv, user, booking, listing, setMessages, language],
  )

  const handleSendPassportRequest = useCallback(async () => {
    if (!selectedConv || !user) return
    try {
      const res = await fetch('/api/v2/chat/messages', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConv.id,
          type: 'system',
          content: '',
          metadata: { system_key: 'passport_request' },
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        toast.error(json.error || getUIText('listingDetail_networkError', language))
        return
      }
      if (json.data) setMessages((prev) => [...prev, json.data])
      inbox.refresh()
    } catch {
      toast.error(getUIText('listingDetail_networkError', language))
    }
  }, [selectedConv, user, setMessages, inbox, language])

  const handleAttachFile = useCallback(
    async (file) => {
      if (!selectedConv || !user) return
      try {
        await sendMedia(file, file.type.startsWith('image/') ? 'image' : 'file')
        inbox.refresh()
      } catch (err) {
        toast.error(err?.message || getUIText('messengerThread_fileUploadFailed', language))
      }
    },
    [selectedConv, user, sendMedia, inbox, language],
  )

  const handleGuestVoiceBlobSend = useCallback(async () => {
    if (!voiceBlob || !user?.id || !selectedConv) return
    setVoiceSending(true)
    try {
      const mime = voiceBlob.type || 'audio/webm'
      const ext = mime.includes('ogg')
        ? 'ogg'
        : mime.includes('mp4')
          ? 'm4a'
          : mime.includes('mpeg')
            ? 'mp3'
            : 'webm'
      const file = new File([voiceBlob], `voice_${Date.now()}.${ext}`, { type: mime })
      const { url: voiceUrl } = await uploadChatVoice(file, user.id)
      const res = await fetch('/api/v2/chat/messages', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConv.id,
          type: 'voice',
          content: '',
          metadata: { voice_url: voiceUrl, duration_sec: voiceDuration },
        }),
      })
      const json = await res.json()
      if (res.ok && json.success && json.data) {
        const mapped = mapApiMessageToRow(json.data, {
          viewerUserId: user.id,
          viewerRole: viewerRoleForHook,
          bookingStatus: booking?.status ?? null,
          listingCategory: selectedConv?.listingCategory ?? null,
          conversation: conversationForMapper,
        })
        if (mapped) setMessages((prev) => [...prev, mapped])
        discardVoice()
        inbox.refresh()
      } else {
        toast.error(json.error || getUIText('listingDetail_networkError', language))
      }
    } catch {
      toast.error(getUIText('listingDetail_networkError', language))
    } finally {
      setVoiceSending(false)
    }
  }, [voiceBlob, user, selectedConv, voiceDuration, booking?.status, setMessages, discardVoice, inbox, viewerRoleForHook, conversationForMapper, language])

  const handleInboxTabChange = useCallback(
    (next) => {
      inbox.setInboxTab(next)
      const list = inbox.conversations.filter((c) =>
        next === INBOX_TAB_HOSTING
          ? String(c.partnerId) === String(user?.id)
          : String(c.renterId) === String(user?.id),
      )
      if (conversationId && !list.some((c) => c.id === conversationId)) {
        if (list[0]) {
          router.push(`/messages/${list[0].id}/`)
        } else router.push('/messages/')
      }
    },
    [inbox, conversationId, router, user?.id],
  )

  const handleConversationSelect = useCallback(
    (id) => {
      router.push(`/messages/${id}/`)
    },
    [router],
  )

  const onInvoiceCancelled = useCallback(
    (msgId) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                metadata: {
                  ...m.metadata,
                  invoice: { ...m.metadata?.invoice, status: 'CANCELLED' },
                },
              }
            : m,
        ),
      )
    },
    [setMessages],
  )

  const threadContextValue = useMemo(
    () => ({
      conversationId,
      user,
      userId: user?.id,
      language,
      messages,
      setMessages,
      isLoading: threadLoading,
      isConnected: isRealtimeConnected,
      selectedConv,
      setSelectedConv,
      listing,
      booking,
      setBooking,
      isHosting,
      isTraveling,
      isPartnerAccount,
      chatContactName,
    }),
    [
      conversationId,
      user,
      language,
      messages,
      setMessages,
      threadLoading,
      isRealtimeConnected,
      selectedConv,
      setSelectedConv,
      listing,
      booking,
      setBooking,
      isHosting,
      isTraveling,
      isPartnerAccount,
      chatContactName,
    ],
  )

  if (authLoading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    )
  }
  if (!user) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-8">
        <p className="text-slate-600">{getUIText('messengerThread_signInRequired', language)}</p>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => openLoginModal?.('login')}>
          {getUIText('messengerThread_signIn', language)}
        </Button>
      </div>
    )
  }

  const listingIdForCalendar = listing?.id ?? selectedConv?.listingId ?? selectedConv?.listing_id ?? null
  const mobileHeaderIconClass =
    'h-9 w-9 shrink-0 rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-[0_2px_12px_rgba(15,23,42,0.07)] hover:bg-slate-50'
  const headerSlot = selectedConv ? (
    <StickyChatHeader
      listing={listing}
      booking={booking}
      language={language}
      isAdminView={false}
      embedded
      compact
      groupDesktopTools={isPartnerAccount}
      messagesListHref={inboxListHref}
      hideBackButton={false}
      unifiedMobileTopBar
      mobileTopBarActions={
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(mobileHeaderIconClass)}
            title={getUIText('messengerThread_dealDetailsAria', language)}
            aria-label={getUIText('messengerThread_dealDetailsAria', language)}
            onClick={() => setDealSheetOpen(true)}
          >
            <Info className="h-4 w-4" strokeWidth={2} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(mobileHeaderIconClass)}
                title={getUIText('messengerThread_conversationArchiveAria', language)}
                aria-label={getUIText('messengerThread_archive', language)}
              >
                <Archive className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                className="cursor-pointer gap-2"
                onClick={() => void archiveConversation(selectedConv.id)}
              >
                <Archive className="h-4 w-4 shrink-0" />
                {getUIText('messengerThread_archiveThisChat', language)}
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={archivedHallHref} className="cursor-pointer gap-2">
                  {getUIText('messengerThread_allArchivedChats', language)}
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
      catalogHref="/listings"
      className="border-b border-slate-200/80 bg-white/90 px-0 shadow-none backdrop-blur-md xl:border-0 xl:bg-transparent xl:backdrop-blur-none"
      showBookingTimeline={Boolean(booking?.id && booking?.status)}
      contactName={chatContactName}
      presenceOnline={peerOnline}
      lastSeenAt={peerLastSeenAt || persistedPeerLastSeenAt}
      typingIndicator={typingLine}
      typingGateWithPresence
      onMediaGallery={() => setMediaGalleryOpen(true)}
      onSearchToggle={() => {
        setSearchActive((v) => !v)
        setSearchQuery('')
      }}
      searchActive={searchActive}
      onDealInfoClick={() => setDealSheetOpen(true)}
      partnerBookingActions={{
        visible:
          isHosting &&
          !!booking?.id &&
          ['PENDING', 'INQUIRY'].includes(String(booking.status || '').toUpperCase()),
        loading: false,
        onConfirm: handleConfirmBooking,
        onDecline: handleDeclineBooking,
      }}
      payNowHref={isHosting ? null : payBarSuppressed ? null : payNowHref}
      onPayNowClick={() => setPayBarSuppressed(true)}
      onSupportClick={() => setSupportDialogOpen(true)}
      supportPriorityActive={!!selectedConv?.isPriority}
      supportLabel={getUIText('messengerThread_labelSupport', language)}
    />
  ) : null

  const searchBarSlot = searchActive ? (
    <ChatSearchBar
      value={searchQuery}
      onChange={setSearchQuery}
      resultCount={searchQuery.trim() ? countSearchResults(messages, searchQuery) : null}
      onClose={() => {
        setSearchActive(false)
        setSearchQuery('')
      }}
      language={language}
    />
  ) : null

  const actionBarSlot = (
    <ChatActionBar
      isHosting={isHosting}
      isTraveling={isTraveling}
      booking={booking}
      payNowHref={payNowHref}
      suppressTravelPayBar={payBarSuppressed}
      suppressMobileHostBar={Boolean(partnerInquiryActionsForMilestone)}
      onPayNowClick={() => setPayBarSuppressed(true)}
      onConfirm={isHosting ? handleConfirmBooking : undefined}
      onDecline={isHosting ? handleDeclineBooking : undefined}
      onOpenInvoice={isHosting ? () => setInvoiceDialogOpen(true) : undefined}
      loading={false}
      language={language}
    />
  )

  const dealDetailsPanel = selectedConv ? (
    <BookingInfoSidebar
      listing={listing}
      booking={booking}
      language={language}
      className="min-h-0"
      onOpenCalendar={listingIdForCalendar ? () => setCalendarOpen(true) : undefined}
    />
  ) : null

  return (
    <MessengerThreadProvider value={threadContextValue}>
      <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
        <RealtimeDiagOverlay conversationId={conversationId} />
        <ChatThreadChrome
          hasThread={!!conversationId}
          sidebarSlot={
            <ConversationSidebar
              inbox={inbox}
              onInboxTabChange={handleInboxTabChange}
              conversationId={conversationId}
              onSelectConversation={handleConversationSelect}
              onArchive={(id) => void archiveConversation(id)}
              archivedHallHref={archivedHallHref}
              language={language}
              isPartnerAccount={isPartnerAccount}
            />
          }
          headerSlot={headerSlot}
          actionBarSlot={actionBarSlot}
          searchBarSlot={searchBarSlot}
          messagesSlot={
            <MessageList
              messages={messages}
              threadLoading={threadLoading}
              userId={user?.id}
              language={language}
              booking={booking}
              listing={listing}
              searchQuery={searchQuery}
              detectedPatterns={detectedPatterns}
              onDismissSafety={() => setSafetyWarningShown(true)}
              mediaGalleryOpen={mediaGalleryOpen}
              onMediaGalleryOpenChange={setMediaGalleryOpen}
              isHosting={isHosting}
              partnerInquiryActions={partnerInquiryActionsForMilestone}
              onInvoiceCancelled={onInvoiceCancelled}
            />
          }
          composerSlot={
            <MessageInput
              isHosting={isHosting}
              newMessage={newMessage}
              onMessageChange={setNewMessage}
              onSubmit={handleSendText}
              sending={sending}
              disabled={!selectedConv}
              booking={booking}
              listing={listing}
              language={language}
              onSendInvoice={handleSendInvoice}
              onSendPassportRequest={handleSendPassportRequest}
              onAttachFile={handleAttachFile}
              onSendVoice={handleSendVoice}
              userId={user?.id}
              invoiceDialogOpen={invoiceDialogOpen}
              onInvoiceDialogOpenChange={setInvoiceDialogOpen}
              voiceBlob={voiceBlob}
              voicePreviewUrl={voicePreviewUrl}
              voiceDurationLabel={voiceDurationLabel}
              voiceRecording={voiceRecording}
              voiceSending={voiceSending}
              onStartVoice={startVoice}
              onStopVoice={stopVoice}
              onDiscardVoice={discardVoice}
              onGuestVoiceSend={handleGuestVoiceBlobSend}
              broadcastTyping={broadcastTyping}
              broadcastTypingStop={broadcastTypingStop}
            />
          }
          sidePanelSlot={dealDetailsPanel}
          language={language}
          className="h-full min-h-0 w-full flex-1"
        />

        <PartnerChatCalendarPeek
          mode={isHosting ? 'partner' : 'renter'}
          listingId={listingIdForCalendar}
          listingTitle={listing?.title}
          language={language}
          open={calendarOpen}
          onOpenChange={setCalendarOpen}
          hideTrigger
        />

        <ThreadDealDetailsSheet
          open={dealSheetOpen}
          onOpenChange={setDealSheetOpen}
          dealDetailsPanel={dealDetailsPanel}
          onOpenSupport={() => setSupportDialogOpen(true)}
          onOpenMediaGallery={() => setMediaGalleryOpen(true)}
          onOpenSearch={() => {
            setSearchActive(true)
            setSearchQuery('')
          }}
          language={language}
        />

        <DeclineBookingDialog
          open={declineOpen}
          onOpenChange={setDeclineOpen}
          declinePreset={declinePreset}
          onDeclinePresetChange={setDeclinePreset}
          declineOtherDetail={declineOtherDetail}
          onDeclineOtherDetailChange={setDeclineOtherDetail}
          onConfirmDecline={confirmDecline}
          language={language}
        />

        <SupportRequestDialog
          open={supportDialogOpen}
          onOpenChange={setSupportDialogOpen}
          conversationId={selectedConv?.id}
          language={language}
          onSubmitted={() => {
            setSelectedConv((prev) => (prev ? { ...prev, isPriority: true } : prev))
            reloadThread()
            inbox.refresh()
          }}
        />
      </div>
    </MessengerThreadProvider>
  )
}
