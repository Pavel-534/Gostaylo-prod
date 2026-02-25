'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Send, Loader2, ArrowLeft, Image as ImageIcon, Smile } from 'lucide-react'
import { ListingContextCard } from '@/components/listing-context-card'
import { BookingRequestCard, SystemMessage } from '@/components/booking-request-card'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import { toast } from 'sonner'

export default function PartnerMessages({ params }) {
  const router = useRouter()
  const messagesEndRef = useRef(null)
  const [conversations, setConversations] = useState([])
  const [selectedConv, setSelectedConv] = useState(null)
  const [messages, setMessages] = useState([])
  const [listing, setListing] = useState(null)
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  const partnerId = 'partner-1'
  const conversationId = params?.id

  useEffect(() => {
    loadConversations()
  }, [])

  useEffect(() => {
    if (conversationId) {
      loadMessages(conversationId)
    } else if (conversations.length > 0 && !selectedConv) {
      router.push(`/partner/messages/${conversations[0].id}`)
    }
  }, [conversationId, conversations])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  async function loadConversations() {
    try {
      const res = await fetch(`/api/conversations?userId=${partnerId}&role=PARTNER`)
      const data = await res.json()
      setConversations(data.data || [])
      setLoading(false)
    } catch (error) {
      console.error('Failed to load conversations:', error)
      setLoading(false)
    }
  }

  async function loadMessages(convId) {
    try {
      const res = await fetch(`/api/conversations/${convId}/messages`)
      const data = await res.json()
      
      if (data.success) {
        setMessages(data.data.messages || [])
        setSelectedConv(data.data.conversation)
        setListing(data.data.listing)
      }
    } catch (error) {
      console.error('Failed to load messages:', error)
    }
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!newMessage.trim() || !selectedConv) return

    setSending(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConv.id,
          senderId: partnerId,
          senderRole: 'PARTNER',
          senderName: 'Иван Партнёров',
          message: newMessage,
        }),
      })

      const data = await res.json()
      if (data.success) {
        setMessages([...messages, data.data])
        setNewMessage('')
        loadConversations() // Refresh to update last message
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      toast.error('Ошибка при отправке сообщения')
    } finally {
      setSending(false)
    }
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  function handleBookingStatusUpdate(newStatus) {
    // Reload messages to show new system message
    setTimeout(() => {
      loadMessages(conversationId)
      loadConversations()
    }, 500)
  }

  if (loading) {
    return (
      <div className=\"flex items-center justify-center h-screen\">
        <Loader2 className=\"h-8 w-8 animate-spin text-teal-600\" />
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className=\"p-4 lg:p-8\">
        <div className=\"flex flex-col items-center justify-center h-96\">
          <div className=\"text-center\">
            <h3 className=\"text-xl font-semibold text-slate-900 mb-2\">
              Нет активных диалогов
            </h3>
            <p className=\"text-slate-600\">
              Когда клиенты напишут вам, диалоги появятся здесь
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className=\"h-screen flex flex-col lg:flex-row bg-slate-50\">
      {/* Conversations Sidebar */}
      <div className={`w-full lg:w-80 bg-white border-r flex-shrink-0 ${
        conversationId ? 'hidden lg:flex' : 'flex'
      } flex-col`}>
        <div className=\"p-4 border-b\">
          <h2 className=\"text-xl font-bold text-slate-900\">Сообщения</h2>
        </div>

        <div className=\"flex-1 overflow-y-auto\">
          {conversations.map((conv) => {
            const isActive = conv.id === conversationId
            const unread = conv.unreadCountPartner || 0

            return (
              <div
                key={conv.id}
                onClick={() => router.push(`/partner/messages/${conv.id}`)}
                className={`p-4 border-b cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-teal-50 border-l-4 border-l-teal-600'
                    : 'hover:bg-slate-50'
                }`}
              >
                <div className=\"flex gap-3\">
                  <img
                    src={conv.listing?.images?.[0] || '/placeholder.jpg'}
                    alt={conv.listing?.title}
                    className=\"w-12 h-12 rounded-lg object-cover\"
                  />
                  <div className=\"flex-1 min-w-0\">
                    <div className=\"flex items-start justify-between mb-1\">
                      <p className=\"font-semibold text-sm text-slate-900 truncate\">
                        {conv.renterName}
                      </p>
                      {unread > 0 && (
                        <Badge className=\"bg-red-500 text-white ml-2\">
                          {unread}
                        </Badge>
                      )}
                    </div>
                    <p className=\"text-xs text-slate-600 truncate mb-1\">
                      {conv.listing?.title}
                    </p>
                    <p className=\"text-xs text-slate-500 truncate\">
                      {conv.lastMessage?.message || 'Новое сообщение'}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Chat Window */}
      {conversationId && selectedConv ? (
        <div className=\"flex-1 flex flex-col\">
          {/* Chat Header */}
          <div className=\"bg-white border-b p-4\">
            <div className=\"flex items-center gap-3\">
              <Button
                variant=\"ghost\"
                size=\"icon\"
                className=\"lg:hidden\"
                onClick={() => router.push('/partner/messages')}
              >
                <ArrowLeft className=\"h-5 w-5\" />
              </Button>
              <div className=\"flex-1\">
                <h3 className=\"font-semibold text-slate-900\">
                  {selectedConv.renterName}
                </h3>
                <p className=\"text-sm text-slate-600\">
                  {listing?.district}
                </p>
              </div>
            </div>
          </div>

          {/* Listing Context Card */}
          <div className=\"bg-white border-b p-4\">
            <ListingContextCard listing={listing} />
          </div>

          {/* Messages */}
          <div className=\"flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50\">
            {messages.map((msg) => {
              if (msg.type === 'BOOKING_REQUEST') {
                return (
                  <BookingRequestCard
                    key={msg.id}
                    message={msg}
                    userRole=\"PARTNER\"
                    onStatusUpdate={handleBookingStatusUpdate}
                  />
                )
              }

              if (msg.senderRole === 'SYSTEM') {
                return <SystemMessage key={msg.id} message={msg} />
              }

              const isOwn = msg.senderId === partnerId
              const isPartner = msg.senderRole === 'PARTNER'

              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <Avatar className=\"w-8 h-8 flex-shrink-0\">
                    <AvatarFallback className={isPartner ? 'bg-teal-100 text-teal-700' : 'bg-slate-200'}>
                      {msg.senderName?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-md`}>
                    <div
                      className={`px-4 py-2 rounded-2xl ${
                        isOwn
                          ? 'bg-teal-600 text-white rounded-tr-none'
                          : 'bg-white text-slate-900 rounded-tl-none shadow-sm'
                      }`}
                    >
                      <p className=\"text-sm whitespace-pre-wrap break-words\">
                        {msg.message}
                      </p>
                    </div>
                    <span className=\"text-xs text-slate-500 mt-1\">
                      {formatDistanceToNow(new Date(msg.createdAt), {
                        addSuffix: true,
                        locale: ru,
                      })}
                    </span>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className=\"bg-white border-t p-4\">
            <form onSubmit={sendMessage} className=\"flex gap-2\">
              <Button
                type=\"button\"
                variant=\"ghost\"
                size=\"icon\"
                className=\"flex-shrink-0\"
              >
                <ImageIcon className=\"h-5 w-5 text-slate-400\" />
              </Button>
              <Button
                type=\"button\"
                variant=\"ghost\"
                size=\"icon\"
                className=\"flex-shrink-0\"
              >
                <Smile className=\"h-5 w-5 text-slate-400\" />
              </Button>
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder=\"Напишите сообщение...\"
                className=\"flex-1\"
                disabled={sending}
              />
              <Button
                type=\"submit\"
                disabled={!newMessage.trim() || sending}
                className=\"bg-teal-600 hover:bg-teal-700 flex-shrink-0\"
              >
                {sending ? (
                  <Loader2 className=\"h-4 w-4 animate-spin\" />
                ) : (
                  <Send className=\"h-4 w-4\" />
                )}
              </Button>
            </form>
          </div>
        </div>
      ) : (
        <div className=\"flex-1 hidden lg:flex items-center justify-center bg-slate-50\">
          <div className=\"text-center\">
            <h3 className=\"text-xl font-semibold text-slate-900 mb-2\">
              Выберите диалог
            </h3>
            <p className=\"text-slate-600\">
              Выберите диалог из списка слева
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
