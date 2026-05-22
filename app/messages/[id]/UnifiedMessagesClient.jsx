'use client'

/**
 * @file app/messages/[id]/UnifiedMessagesClient.jsx
 * Единый тред: композиция хуков (Stage 109.3) + UI в `components/`.
 */

import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import nextDynamic from 'next/dynamic'
import { Archive, Loader2, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { detectUnsafePatterns } from '@/components/chat-safety'
import { cn } from '@/lib/utils'
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
import { ChatThreadChrome } from '@/components/chat/ChatThreadChrome'
import { RealtimeDiagOverlay } from '@/components/chat/RealtimeDiagOverlay'
import { StickyChatHeader } from '@/components/sticky-chat-header'
import { ChatActionBar } from '@/components/chat-action-bar'
import { ChatSearchBar } from '@/components/chat-search-bar'
import { SupportRequestDialog } from '@/components/support-request-dialog'
import { countSearchResults } from '@/lib/chat/message-filters'
import { useThreadArchive } from './hooks/useThreadArchive'
import { useUnifiedMessagesThread } from './hooks/useUnifiedMessagesThread'
import { useUnifiedMessagesPeer } from './hooks/useUnifiedMessagesPeer'
import { useUnifiedMessagesBookingActions } from './hooks/useUnifiedMessagesBookingActions'
import { useUnifiedMessagesOutbound } from './hooks/useUnifiedMessagesOutbound'
import { useUnifiedMessagesNavigation } from './hooks/useUnifiedMessagesNavigation'
import { MessengerThreadProvider } from './context/ChatContext'
import { ConversationSidebar } from './components/ConversationSidebar'
import { MessageList } from './components/MessageList'
import { MessageInput } from './components/MessageInput'
import { BookingInfoSidebar } from './components/BookingInfoSidebar'
import { ThreadDealDetailsSheet } from './components/ThreadDealDetailsSheet'
import { DeclineBookingDialog } from './components/DeclineBookingDialog'
import { MessagesAuthGate } from '@/components/product/MessagesAuthGate'
import { GuestBookingFlowHint } from '@/components/product/GuestBookingFlowHint'

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
  const [searchQuery, setSearchQuery] = useState('')
  const [searchActive, setSearchActive] = useState(false)
  const [mediaGalleryOpen, setMediaGalleryOpen] = useState(false)
  const [supportDialogOpen, setSupportDialogOpen] = useState(false)
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

  const markNowRef = useRef(null)
  const thread = useUnifiedMessagesThread({
    conversationId,
    user,
    isPartnerAccount,
    viewerRoleForHook,
    markGlobalRead,
    onThreadNewMessage: () => markNowRef.current?.(),
  })

  const {
    messages,
    isLoading: threadLoading,
    isConnected: isRealtimeConnected,
    selectedConv,
    listing,
    booking,
    sendMessage: sendMessageText,
    sendVoice: sendVoiceMessage,
    sendVoiceFromUrl,
    sendPassportRequest,
    sendInvoice,
    sendMedia,
    appendMessage,
    reload: reloadThread,
    setMessages,
    setBooking,
    setSelectedConv,
    inbox,
    isHosting,
    isTraveling,
    conversationForMapper,
  } = thread

  const peer = useUnifiedMessagesPeer({
    conversationId,
    user,
    language,
    selectedConv,
    typingByConversation,
    messages,
    booking,
    isHosting,
  })
  markNowRef.current = peer.markNow

  useEffect(() => {
    setPayBarSuppressed(false)
  }, [conversationId, booking?.id])

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

  const inboxListHref = '/messages/'
  const archivedHallHref = '/messages/archived/'

  const { archiveConversation } = useThreadArchive({
    language,
    router,
    inbox,
    conversationId,
    inboxListHref,
    archivedListHref: archivedHallHref,
  })

  const bookingActions = useUnifiedMessagesBookingActions({
    language,
    booking,
    selectedConv,
    setBooking,
    inbox,
    reloadThread,
    isHosting,
  })

  const outbound = useUnifiedMessagesOutbound({
    language,
    user,
    selectedConv,
    inbox,
    sendMessageText,
    sendVoiceMessage,
    sendVoiceFromUrl,
    sendPassportRequest,
    sendInvoice,
    sendMedia,
    appendMessage,
    setMessages,
    broadcastTypingStop: peer.broadcastTypingStop,
    newMessage,
    setNewMessage,
    setSending,
    voiceBlob,
    voiceDuration,
    discardVoice,
    setVoiceSending,
  })

  const { handleInboxTabChange, handleConversationSelect } = useUnifiedMessagesNavigation({
    router,
    inbox,
    conversationId,
    user,
  })

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
      chatContactName: peer.chatContactName,
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
      peer.chatContactName,
    ],
  )

  const authGate = (
    <MessagesAuthGate
      authLoading={authLoading}
      user={user}
      language={language}
      openLoginModal={openLoginModal}
    />
  )
  if (authLoading || !user) return authGate

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
      contactName={peer.chatContactName}
      presenceOnline={peer.peerOnline}
      lastSeenAt={peer.peerLastSeenAt || peer.persistedPeerLastSeenAt}
      typingIndicator={peer.typingLine}
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
        onConfirm: bookingActions.handleConfirmBooking,
        onDecline: bookingActions.handleDeclineBooking,
      }}
      payNowHref={isHosting ? null : payBarSuppressed ? null : peer.payNowHref}
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
      payNowHref={peer.payNowHref}
      suppressTravelPayBar={payBarSuppressed}
      suppressMobileHostBar={Boolean(bookingActions.partnerInquiryActionsForMilestone)}
      onPayNowClick={() => setPayBarSuppressed(true)}
      onConfirm={isHosting ? bookingActions.handleConfirmBooking : undefined}
      onDecline={isHosting ? bookingActions.handleDeclineBooking : undefined}
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
            <div className="flex h-full min-h-0 flex-col">
              {!isPartnerAccount ? (
                <div className="shrink-0 border-b border-slate-100 px-3 py-2 hidden lg:block">
                  <GuestBookingFlowHint t={(key) => getUIText(key, language)} />
                </div>
              ) : null}
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
            </div>
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
              partnerInquiryActions={bookingActions.partnerInquiryActionsForMilestone}
              onInvoiceCancelled={outbound.onInvoiceCancelled}
            />
          }
          composerSlot={
            <MessageInput
              isHosting={isHosting}
              newMessage={newMessage}
              onMessageChange={setNewMessage}
              onSubmit={outbound.handleSendText}
              sending={sending}
              disabled={!selectedConv}
              booking={booking}
              listing={listing}
              language={language}
              onSendInvoice={outbound.handleSendInvoice}
              onSendPassportRequest={outbound.handleSendPassportRequest}
              onAttachFile={outbound.handleAttachFile}
              onSendVoice={outbound.handleSendVoice}
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
              onGuestVoiceSend={outbound.handleGuestVoiceBlobSend}
              broadcastTyping={peer.broadcastTyping}
              broadcastTypingStop={peer.broadcastTypingStop}
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
          bookingId={booking?.id ?? null}
          bookingStatus={booking?.status ?? null}
          financialSnapshotInitial={booking?.financial_snapshot ?? null}
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
          open={bookingActions.declineOpen}
          onOpenChange={bookingActions.setDeclineOpen}
          declinePreset={bookingActions.declinePreset}
          onDeclinePresetChange={bookingActions.setDeclinePreset}
          declineOtherDetail={bookingActions.declineOtherDetail}
          onDeclineOtherDetailChange={bookingActions.setDeclineOtherDetail}
          onConfirmDecline={bookingActions.confirmDecline}
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
