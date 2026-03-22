'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Send,
  Loader2,
  ArrowLeft,
  Check,
  CheckCheck,
  AlertTriangle,
  MessageSquare,
  Building2,
  Shield,
  Wifi,
  WifiOff,
  Receipt,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import { toast } from 'sonner'
import { useRealtimeMessages, usePresence, playNotificationSound } from '@/hooks/use-realtime-chat'
import { SendInvoiceDialog, InvoiceCard } from '@/components/chat-invoice'
import { ConversationList } from '@/components/conversation-list'

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

  const { isConnected } = useRealtimeMessages(conversationId, handleNewRealtimeMessage)
  const { isOnline: renterOnline } = usePresence(conversationId, user?.id)

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

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  function getReadStatus(msg) {
    if (msg.sender_id !== user?.id) return null

    return msg.is_read ? (
      <CheckCheck className="h-3 w-3 text-blue-500" />
    ) : (
      <Check className="h-3 w-3 text-slate-400" />
    )
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
      />

      {conversationId && selectedConv ? (
        <div className="flex-1 flex flex-col">
          <div className="bg-white border-b p-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => router.push('/partner/messages')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  {selectedConv.adminId ? (
                    <>
                      <Shield className="h-4 w-4 text-indigo-500" />
                      {selectedConv.adminName || 'Администратор Gostaylo'}
                    </>
                  ) : (
                    <>
                      {selectedConv.renterName || 'Клиент'}
                      <span
                        className={`w-2 h-2 rounded-full ${renterOnline ? 'bg-green-500' : 'bg-slate-300'}`}
                      />
                    </>
                  )}
                </h3>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-slate-600">{listing?.title || selectedConv.type}</p>
                  <span
                    className={`flex items-center gap-1 text-xs ${isConnected ? 'text-green-600' : 'text-orange-500'}`}
                  >
                    {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                    {isConnected ? 'Live' : 'Connecting'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {listing && (
            <div className="bg-white border-b p-4">
              <div className="flex gap-3 p-3 bg-slate-50 rounded-lg">
                {listing.images?.[0] ? (
                  <img
                    src={listing.images[0]}
                    alt={listing.title}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 bg-slate-200 rounded-lg flex items-center justify-center">
                    <Building2 className="h-8 w-8 text-slate-400" />
                  </div>
                )}
                <div>
                  <p className="font-medium text-slate-900">{listing.title}</p>
                  <p className="text-sm text-slate-600">{listing.district}</p>
                  <p className="text-sm font-semibold text-teal-600">
                    {listing.base_price_thb?.toLocaleString()} THB/day
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {messages.map((msg) => {
              const isOwn = msg.sender_id === user?.id
              const isAdmin = msg.sender_role === 'ADMIN'
              const msgType = (msg.type || '').toLowerCase()
              const isRejection = msgType === 'rejection'
              const isInvoice = msgType === 'invoice' || msg.type === 'INVOICE'

              if (isInvoice && msg.metadata?.invoice) {
                return (
                  <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <InvoiceCard
                      invoice={msg.metadata.invoice}
                      isOwn={isOwn}
                      paymentMethod={msg.metadata.invoice.payment_method}
                    />
                  </div>
                )
              }

              return (
                <div key={msg.id} className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarFallback
                      className={
                        isOwn
                          ? 'bg-teal-100 text-teal-700'
                          : isAdmin
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-slate-200'
                      }
                    >
                      {isAdmin ? (
                        <Shield className="h-4 w-4" />
                      ) : (
                        msg.sender_name?.[0]?.toUpperCase() || 'U'
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-md`}>
                    {!isOwn && (
                      <span className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                        {isAdmin && <Shield className="h-3 w-3 text-indigo-500" />}
                        {msg.sender_name || 'User'}
                      </span>
                    )}
                    <div
                      className={`px-4 py-2 rounded-2xl ${
                        isRejection
                          ? 'bg-red-50 text-red-900 border border-red-200 rounded-tl-none'
                          : isOwn
                            ? 'bg-teal-600 text-white rounded-tr-none'
                            : isAdmin
                              ? 'bg-indigo-50 text-indigo-900 border border-indigo-200 rounded-tl-none'
                              : 'bg-white text-slate-900 rounded-tl-none shadow-sm'
                      }`}
                    >
                      {isRejection && (
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-red-200">
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                          <span className="font-semibold text-sm">Listing Rejected</span>
                        </div>
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {msg.message ?? msg.content}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xs text-slate-500">
                        {msg.created_at &&
                          formatDistanceToNow(new Date(msg.created_at), {
                            addSuffix: true,
                            locale: ru,
                          })}
                      </span>
                      {getReadStatus(msg)}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          <div className="bg-white border-t p-4">
            <form onSubmit={sendMessage} className="flex gap-2">
              <SendInvoiceDialog
                booking={booking}
                listing={listing}
                onSend={handleSendInvoice}
                trigger={
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="flex-shrink-0 border-amber-300 hover:bg-amber-50"
                    data-testid="send-invoice-btn"
                  >
                    <Receipt className="h-4 w-4 text-amber-600" />
                  </Button>
                }
              />
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1"
                disabled={sending}
              />
              <Button
                type="submit"
                disabled={!newMessage.trim() || sending}
                className="bg-teal-600 hover:bg-teal-700 flex-shrink-0"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
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
