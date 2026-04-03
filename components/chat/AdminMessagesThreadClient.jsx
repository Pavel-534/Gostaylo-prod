'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Paperclip, Send } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChatThreadChrome } from '@/components/chat/ChatThreadChrome'
import { StickyChatHeader } from '@/components/sticky-chat-header'
import { ChatMessageList } from '@/components/chat/ChatMessageList'
import { AdminConversationSidebar } from '@/components/chat/AdminConversationSidebar'
import { AdminChatPinnedSlot } from '@/components/chat/AdminChatPinnedSlot'
import { useChatThreadMessages } from '@/hooks/use-chat-thread-messages'
import { useMarkConversationRead } from '@/hooks/use-mark-conversation-read'
import { usePresence } from '@/hooks/use-realtime-chat'
import { getUIText } from '@/lib/translations'
import { isBookingPaid } from '@/lib/mask-contacts'

export function AdminMessagesThreadClient({ conversationId, me, language = 'ru' }) {
  const router = useRouter()
  const [conversations, setConversations] = useState([])
  const [convLoading, setConvLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [priorityOnly, setPriorityOnly] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [joinSupportLoading, setJoinSupportLoading] = useState(false)
  const attachFileRef = useRef(null)

  const t = useCallback((key) => getUIText(key, language), [language])

  const loadConversations = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setConvLoading(true)
      try {
        const res = await fetch('/api/v2/chat/conversations?enrich=1', { credentials: 'include' })
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
          setConversations(json.data)
        } else {
          setConversations([])
        }
      } catch {
        if (!silent) setConversations([])
      } finally {
        if (!silent) setConvLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    void loadConversations()
  }, [loadConversations])

  useEffect(() => {
    void loadConversations({ silent: true })
  }, [conversationId, loadConversations])

  const refreshSidebar = useCallback(() => void loadConversations({ silent: true }), [loadConversations])

  const {
    messages,
    isLoading: threadLoading,
    selectedConv,
    listing,
    booking,
    sendMessage: sendThreadMessage,
    sendMedia,
    reload,
  } = useChatThreadMessages({
    conversationId,
    userId: me?.id ?? null,
    viewerRole: 'admin',
    onMarkRead: () => {},
    onNewMessage: () => refreshSidebar(),
  })

  const { isOnline: peerOnline } = usePresence(conversationId, me?.id, null)
  useMarkConversationRead(conversationId, false, peerOnline)

  const latestSupportTicket = useMemo(() => {
    if (!messages?.length) return null
    for (let i = messages.length - 1; i >= 0; i--) {
      const st = messages[i]?.metadata?.support_ticket
      if (st?.category && st?.disputeType) return st
    }
    return null
  }, [messages])

  const filteredConversations = useMemo(() => {
    const list = conversations
      .filter((conv) => {
        if (!searchQuery.trim()) return true
        const q = searchQuery.toLowerCase()
        return (
          conv.partnerName?.toLowerCase().includes(q) ||
          conv.renterName?.toLowerCase().includes(q) ||
          conv.listing?.title?.toLowerCase().includes(q)
        )
      })
      .filter((conv) => !priorityOnly || conv.isPriority)
    return list
  }, [conversations, searchQuery, priorityOnly])

  const sidebarToolbar = (
    <div className="shrink-0 border-b border-slate-200 bg-white px-2 py-2">
      <Button
        type="button"
        variant={priorityOnly ? 'default' : 'outline'}
        size="sm"
        className={priorityOnly ? 'bg-amber-600 hover:bg-amber-700' : ''}
        onClick={() => setPriorityOnly((v) => !v)}
      >
        {t('adminPriorityFilter')}
      </Button>
    </div>
  )

  const showJoinAsSupport =
    !!selectedConv &&
    !!me &&
    String(selectedConv.adminId ?? selectedConv.admin_id ?? '') !== String(me.id)

  const handleJoinAsSupport = useCallback(async () => {
    if (!selectedConv?.id || !me || joinSupportLoading) return
    setJoinSupportLoading(true)
    try {
      const res = await fetch('/api/v2/chat/support/join', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConv.id,
          lang: language === 'ru' ? 'ru' : 'en',
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        toast.error(json.error || (language === 'ru' ? 'Не удалось вступить в диалог' : 'Could not join'))
        return
      }
      if (json.data?.alreadyJoined) {
        toast.message(language === 'ru' ? 'Вы уже в этом диалоге' : 'You are already in this conversation')
      } else {
        toast.success(language === 'ru' ? 'Вы вступили в диалог' : 'You joined the conversation')
      }
      await reload()
      await refreshSidebar()
    } catch (err) {
      toast.error(err?.message || (language === 'ru' ? 'Ошибка сети' : 'Network error'))
    } finally {
      setJoinSupportLoading(false)
    }
  }, [selectedConv, me, joinSupportLoading, language, reload, refreshSidebar])

  const handleSend = useCallback(
    async (e) => {
      e.preventDefault()
      if (!newMessage.trim() || !conversationId || !me) return
      setSending(true)
      try {
        const ok = await sendThreadMessage(newMessage.trim(), { skipPush: !!peerOnline })
        if (ok) {
          setNewMessage('')
          await refreshSidebar()
        }
      } finally {
        setSending(false)
      }
    },
    [newMessage, conversationId, me, sendThreadMessage, peerOnline, refreshSidebar]
  )

  const handleAttachFile = useCallback(
    async (file) => {
      if (!file || !conversationId || !me) return
      setSending(true)
      try {
        const isImg = file.type.startsWith('image/')
        const type = isImg ? 'image' : 'file'
        const data = await sendMedia(file, type)
        if (data) await refreshSidebar()
      } finally {
        setSending(false)
      }
    },
    [conversationId, me, sendMedia, refreshSidebar]
  )

  const sidebarSlot = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {sidebarToolbar}
      <div className="min-h-0 flex-1 overflow-hidden">
        <AdminConversationSidebar
          conversations={filteredConversations}
          loading={convLoading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedConversationId={conversationId}
          onSelectConversation={(id) => router.push(`/admin/messages/${id}`)}
          searchPlaceholder={t('adminConversationsSearchPlaceholder')}
          language={language}
        />
      </div>
    </div>
  )

  const adminParticipants = selectedConv
    ? {
        renterName: selectedConv.renterName,
        partnerName: selectedConv.partnerName,
        bookingId: selectedConv.bookingId || booking?.id,
      }
    : null

  const threadNotFound = !threadLoading && !!conversationId && !!me && !selectedConv

  const pinnedSlot = selectedConv ? (
    <AdminChatPinnedSlot
      language={language}
      adminParticipants={adminParticipants}
      showJoinAsSupport={showJoinAsSupport}
      joinSupportLoading={joinSupportLoading}
      onJoinAsSupport={handleJoinAsSupport}
      isPriority={Boolean(selectedConv.isPriority)}
      supportTicket={latestSupportTicket}
    />
  ) : null

  const headerSlot = threadNotFound ? null : selectedConv ? (
    <StickyChatHeader
      listing={listing}
      booking={booking}
      isAdminView
      suppressAdminMeta
      language={language}
      className="rounded-none border-0 shadow-none"
      presenceOnline={peerOnline}
      showBookingTimeline={Boolean(booking?.id && booking?.status)}
      bookingTimelineVariant="slim"
      messagesListHref="/admin/messages/"
      hideBackButton={false}
      embedded
      compact
      unifiedMobileTopBar
    />
  ) : null

  const messagesSlot = threadNotFound ? (
    <div className="flex flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <p className="text-sm text-slate-600">
        {language === 'en'
          ? 'This conversation was not found or you do not have access.'
          : 'Диалог не найден или нет доступа.'}
      </p>
      <Button type="button" variant="outline" onClick={() => router.push('/admin/messages/')}>
        {language === 'en' ? 'Back to conversations' : 'К списку диалогов'}
      </Button>
    </div>
  ) : selectedConv && !threadLoading ? (
    <ChatMessageList
      messages={messages}
      userId={me?.id}
      language={language}
      isBookingPaid={isBookingPaid(booking?.status)}
      ownVariant="indigo"
      userRole="partner"
      staffThread
      booking={booking}
      listing={listing}
      className="pb-4 sm:pb-6"
    />
  ) : (
    <div className="flex flex-col items-center justify-center gap-2 py-24 text-slate-500">
      <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      <p className="text-sm">{language === 'en' ? 'Loading messages…' : 'Загрузка сообщений…'}</p>
    </div>
  )

  const composerSlot = selectedConv && !threadNotFound ? (
    <div className="border-t border-slate-200/90 bg-white p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <p className="mb-2 text-xs font-medium text-slate-600">
        {language === 'en'
          ? 'Support reply — visible to both guest and host in this chat'
          : 'Ответ от поддержки — увидят и гость, и партнёр в этом чате'}
      </p>
      <input
        ref={attachFileRef}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void handleAttachFile(f)
        }}
      />
      <form onSubmit={handleSend} className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="flex-shrink-0 border-slate-200"
          disabled={sending}
          aria-label={language === 'en' ? 'Attach file' : 'Прикрепить файл'}
          onClick={() => attachFileRef.current?.click()}
        >
          <Paperclip className="h-5 w-5" />
        </Button>
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder={
            language === 'en' ? 'Write a message as support…' : 'Напишите сообщение от имени поддержки…'
          }
          className="min-w-0 flex-1"
          disabled={sending}
        />
        <Button
          type="submit"
          disabled={!newMessage.trim() || sending}
          className="flex-shrink-0 bg-indigo-600 hover:bg-indigo-700"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  ) : null

  const pinnedFinal = threadNotFound ? null : pinnedSlot

  return (
    <ChatThreadChrome
      hasTread={!!conversationId}
      sidebarSlot={sidebarSlot}
      headerSlot={headerSlot}
      pinnedAboveMessagesSlot={pinnedFinal}
      messagesSlot={messagesSlot}
      composerSlot={composerSlot}
      language={language}
      className="h-full min-h-0 bg-slate-50 lg:bg-white"
    />
  )
}
