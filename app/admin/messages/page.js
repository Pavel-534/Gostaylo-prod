'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { 
  MessageSquare, Send, Loader2, Building2, User, Shield,
  Check, CheckCheck, AlertTriangle, Search, Filter
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import { toast } from 'sonner'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export default function AdminMessagesPage() {
  const messagesEndRef = useRef(null)
  const [conversations, setConversations] = useState([])
  const [selectedConv, setSelectedConv] = useState(null)
  const [messages, setMessages] = useState([])
  const [listing, setListing] = useState(null)
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const headers = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json'
  }

  useEffect(() => {
    loadConversations()
  }, [])

  useEffect(() => {
    if (selectedConv) {
      loadMessages(selectedConv.id)
    }
  }, [selectedConv?.id])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  async function loadConversations() {
    setLoading(true)
    try {
      // Get all conversations
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/conversations?order=updated_at.desc&select=*`,
        { headers }
      )
      const convData = await res.json()

      // Enrich with listings and last messages
      const enriched = await Promise.all(
        (convData || []).map(async (conv) => {
          // Get listing
          let listingData = null
          if (conv.listing_id) {
            const listingRes = await fetch(
              `${SUPABASE_URL}/rest/v1/listings?id=eq.${conv.listing_id}&select=id,title,images,district`,
              { headers }
            )
            const listings = await listingRes.json()
            listingData = listings?.[0]
          }

          // Get last message
          const msgRes = await fetch(
            `${SUPABASE_URL}/rest/v1/messages?conversation_id=eq.${conv.id}&order=created_at.desc&limit=1&select=*`,
            { headers }
          )
          const lastMsgData = await msgRes.json()

          // Count unread (not from admin)
          const unreadRes = await fetch(
            `${SUPABASE_URL}/rest/v1/messages?conversation_id=eq.${conv.id}&is_read=eq.false&sender_role=neq.ADMIN&select=id`,
            { headers }
          )
          const unreadData = await unreadRes.json()

          return {
            ...conv,
            listing: listingData,
            lastMessage: lastMsgData?.[0],
            unreadCount: unreadData?.length || 0
          }
        })
      )

      setConversations(enriched)
    } catch (error) {
      console.error('Failed to load conversations:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadMessages(convId) {
    try {
      // Get messages
      const msgRes = await fetch(
        `${SUPABASE_URL}/rest/v1/messages?conversation_id=eq.${convId}&order=created_at.asc&select=*`,
        { headers }
      )
      const msgData = await msgRes.json()
      setMessages(msgData || [])

      // Get listing
      const conv = conversations.find(c => c.id === convId)
      if (conv?.listing_id) {
        const listingRes = await fetch(
          `${SUPABASE_URL}/rest/v1/listings?id=eq.${conv.listing_id}&select=*`,
          { headers }
        )
        const listingData = await listingRes.json()
        setListing(listingData?.[0])
      } else {
        setListing(null)
      }

      // Mark as read
      await fetch(
        `${SUPABASE_URL}/rest/v1/messages?conversation_id=eq.${convId}&is_read=eq.false&sender_role=neq.ADMIN`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ is_read: true })
        }
      )

      // Update local unread count
      setConversations(prev => 
        prev.map(c => c.id === convId ? { ...c, unreadCount: 0 } : c)
      )
    } catch (error) {
      console.error('Failed to load messages:', error)
    }
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!newMessage.trim() || !selectedConv) return

    setSending(true)
    try {
      const messageData = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        conversation_id: selectedConv.id,
        sender_id: 'admin',
        sender_role: 'ADMIN',
        sender_name: 'Администратор Gostaylo',
        message: newMessage,
        type: 'TEXT',
        is_read: false,
        created_at: new Date().toISOString()
      }

      const res = await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify(messageData)
      })

      if (res.ok) {
        setMessages([...messages, messageData])
        setNewMessage('')

        // Update conversation
        await fetch(`${SUPABASE_URL}/rest/v1/conversations?id=eq.${selectedConv.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ updated_at: new Date().toISOString() })
        })

        loadConversations()
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      toast.error('Ошибка при отправке')
    } finally {
      setSending(false)
    }
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      conv.partner_name?.toLowerCase().includes(q) ||
      conv.renter_name?.toLowerCase().includes(q) ||
      conv.listing?.title?.toLowerCase().includes(q)
    )
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-4">
      {/* Conversations List */}
      <Card className="w-full lg:w-96 flex-shrink-0 flex flex-col">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-5 w-5 text-indigo-600" />
            Сообщения
            {conversations.filter(c => c.unreadCount > 0).length > 0 && (
              <Badge className="bg-red-500 ml-auto">
                {conversations.reduce((sum, c) => sum + c.unreadCount, 0)}
              </Badge>
            )}
          </CardTitle>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Поиск..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-0">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p>Нет сообщений</p>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = selectedConv?.id === conv.id
              const isRejection = conv.type === 'ADMIN_FEEDBACK'

              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConv(conv)}
                  className={`p-4 border-b cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-indigo-50 border-l-4 border-l-indigo-600'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex gap-3">
                    {conv.listing?.images?.[0] ? (
                      <img
                        src={conv.listing.images[0]}
                        alt=""
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-slate-200 flex items-center justify-center">
                        <User className="h-6 w-6 text-slate-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-semibold text-sm text-slate-900 truncate">
                          {conv.partner_name || conv.renter_name || 'Пользователь'}
                        </p>
                        {conv.unreadCount > 0 && (
                          <Badge className="bg-red-500 text-white shrink-0">
                            {conv.unreadCount}
                          </Badge>
                        )}
                      </div>
                      {conv.listing?.title && (
                        <p className="text-xs text-slate-600 truncate mb-1">
                          {conv.listing.title}
                        </p>
                      )}
                      <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                        {conv.lastMessage?.type === 'REJECTION' && (
                          <AlertTriangle className="h-3 w-3 text-red-500" />
                        )}
                        {conv.lastMessage?.message || 'Новый диалог'}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* Chat Window */}
      <Card className="flex-1 flex flex-col">
        {selectedConv ? (
          <>
            {/* Header */}
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-indigo-100 text-indigo-700">
                    {(selectedConv.partner_name || selectedConv.renter_name || 'U').charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-base">
                    {selectedConv.partner_name || selectedConv.renter_name || 'Пользователь'}
                  </CardTitle>
                  <p className="text-xs text-slate-500">
                    {listing?.title || selectedConv.type}
                  </p>
                </div>
              </div>
            </CardHeader>

            {/* Listing Context */}
            {listing && (
              <div className="p-3 border-b bg-slate-50">
                <div className="flex gap-3">
                  {listing.images?.[0] ? (
                    <img
                      src={listing.images[0]}
                      alt=""
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
                    <p className="text-sm font-semibold text-indigo-600">
                      ฿{listing.base_price_thb?.toLocaleString()}/день
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Messages */}
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
              {messages.map((msg) => {
                const isOwn = msg.sender_role === 'ADMIN'
                const isRejection = msg.type === 'REJECTION'

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <Avatar className="w-8 h-8 flex-shrink-0">
                      <AvatarFallback className={
                        isOwn 
                          ? 'bg-indigo-100 text-indigo-700' 
                          : 'bg-slate-200'
                      }>
                        {isOwn ? (
                          <Shield className="h-4 w-4" />
                        ) : (
                          msg.sender_name?.[0]?.toUpperCase() || 'U'
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-md`}>
                      {!isOwn && (
                        <span className="text-xs text-slate-500 mb-1">
                          {msg.sender_name}
                        </span>
                      )}
                      <div
                        className={`px-4 py-2 rounded-2xl ${
                          isRejection
                            ? 'bg-red-50 text-red-900 border border-red-200 rounded-tl-none'
                            : isOwn
                              ? 'bg-indigo-600 text-white rounded-tr-none'
                              : 'bg-white text-slate-900 rounded-tl-none shadow-sm'
                        }`}
                      >
                        {isRejection && (
                          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-red-200">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            <span className="font-semibold text-sm">Отклонение</span>
                          </div>
                        )}
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {msg.message}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-xs text-slate-500">
                          {msg.created_at && formatDistanceToNow(new Date(msg.created_at), {
                            addSuffix: true,
                            locale: ru,
                          })}
                        </span>
                        {isOwn && (
                          msg.is_read ? (
                            <CheckCheck className="h-3 w-3 text-blue-500" />
                          ) : (
                            <Check className="h-3 w-3 text-slate-400" />
                          )
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </CardContent>

            {/* Input */}
            <div className="p-4 border-t bg-white">
              <form onSubmit={sendMessage} className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Напишите сообщение..."
                  className="flex-1"
                  disabled={sending}
                />
                <Button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Выберите диалог
              </h3>
              <p className="text-slate-600">
                Выберите диалог из списка слева
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
