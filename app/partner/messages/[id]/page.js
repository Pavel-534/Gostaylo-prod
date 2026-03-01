'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { 
  Send, Loader2, ArrowLeft, Image as ImageIcon, 
  Check, CheckCheck, AlertTriangle, MessageSquare,
  Building2, Shield
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import { toast } from 'sonner'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyOTEzNSwiZXhwIjoyMDg3NjA1MTM1fQ.KqUyt_yX_Ts45MyOKtZ532-UXbgU9WVvwOtnN94zG8I'

export default function PartnerMessages({ params }) {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const messagesEndRef = useRef(null)
  const [user, setUser] = useState(null)
  const [conversations, setConversations] = useState([])
  const [selectedConv, setSelectedConv] = useState(null)
  const [messages, setMessages] = useState([])
  const [listing, setListing] = useState(null)
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  const conversationId = params?.id

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (user) {
      loadConversations()
    }
  }, [user])

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
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (authUser) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()
      
      setUser({ ...authUser, profile })
    }
    setLoading(false)
  }

  async function loadConversations() {
    try {
      const headers = {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }

      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/conversations?partner_id=eq.${user.id}&order=updated_at.desc&select=*`,
        { headers }
      )
      const convData = await res.json()

      const conversationsWithData = await Promise.all(
        (convData || []).map(async (conv) => {
          let listingData = null
          if (conv.listing_id) {
            const listingRes = await fetch(
              `${SUPABASE_URL}/rest/v1/listings?id=eq.${conv.listing_id}&select=id,title,images,district`,
              { headers }
            )
            const listings = await listingRes.json()
            listingData = listings?.[0]
          }

          const msgRes = await fetch(
            `${SUPABASE_URL}/rest/v1/messages?conversation_id=eq.${conv.id}&order=created_at.desc&limit=1&select=*`,
            { headers }
          )
          const lastMsgData = await msgRes.json()

          const unreadRes = await fetch(
            `${SUPABASE_URL}/rest/v1/messages?conversation_id=eq.${conv.id}&is_read=eq.false&sender_role=neq.PARTNER&select=id`,
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

      setConversations(conversationsWithData)
    } catch (error) {
      console.error('Failed to load conversations:', error)
    }
  }

  async function loadMessages(convId) {
    try {
      const headers = {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }

      const convRes = await fetch(
        `${SUPABASE_URL}/rest/v1/conversations?id=eq.${convId}&select=*`,
        { headers }
      )
      const convData = await convRes.json()
      const conv = convData?.[0]
      
      if (!conv) return

      setSelectedConv(conv)

      const msgRes = await fetch(
        `${SUPABASE_URL}/rest/v1/messages?conversation_id=eq.${convId}&order=created_at.asc&select=*`,
        { headers }
      )
      const msgData = await msgRes.json()
      setMessages(msgData || [])

      if (conv.listing_id) {
        const listingRes = await fetch(
          `${SUPABASE_URL}/rest/v1/listings?id=eq.${conv.listing_id}&select=*`,
          { headers }
        )
        const listingData = await listingRes.json()
        setListing(listingData?.[0])
      }
    } catch (error) {
      console.error('Failed to load messages:', error)
    }
  }

  async function markAsRead(convId) {
    try {
      await fetch(
        `${SUPABASE_URL}/rest/v1/messages?conversation_id=eq.${convId}&is_read=eq.false&sender_role=neq.PARTNER`,
        {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ is_read: true })
        }
      )
    } catch (error) {
      console.error('Failed to mark as read:', error)
    }
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!newMessage.trim() || !selectedConv || !user) return

    setSending(true)
    try {
      const messageData = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        conversation_id: selectedConv.id,
        sender_id: user.id,
        sender_role: 'PARTNER',
        sender_name: user.profile?.name || user.email || 'Partner',
        message: newMessage,
        type: 'TEXT',
        is_read: false,
        created_at: new Date().toISOString()
      }

      const res = await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(messageData)
      })

      if (res.ok) {
        setMessages([...messages, messageData])
        setNewMessage('')
        
        await fetch(`${SUPABASE_URL}/rest/v1/conversations?id=eq.${selectedConv.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ updated_at: new Date().toISOString() })
        })

        loadConversations()
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      toast.error('Ошибка отправки')
    } finally {
      setSending(false)
    }
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  function getReadStatus(msg) {
    if (msg.sender_id !== user?.id) return null
    
    return msg.is_read ? (
      <CheckCheck className='h-3 w-3 text-blue-500' />
    ) : (
      <Check className='h-3 w-3 text-slate-400' />
    )
  }

  if (loading) {
    return (
      <div className='flex items-center justify-center h-screen'>
        <div className='h-8 w-8 animate-spin rounded-full border-b-2 border-teal-600'></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className='p-4 lg:p-8'>
        <div className='flex flex-col items-center justify-center h-96'>
          <div className='text-center'>
            <h3 className='text-xl font-semibold text-slate-900 mb-2'>
              Требуется авторизация
            </h3>
            <p className='text-slate-600'>
              Войдите в систему для просмотра сообщений
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className='p-4 lg:p-8'>
        <div className='flex flex-col items-center justify-center h-96'>
          <MessageSquare className='h-16 w-16 text-slate-300 mb-4' />
          <div className='text-center'>
            <h3 className='text-xl font-semibold text-slate-900 mb-2'>
              Нет сообщений
            </h3>
            <p className='text-slate-600'>
              Когда клиенты или администраторы напишут вам, диалоги появятся здесь
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='h-screen flex flex-col lg:flex-row bg-slate-50'>
      {/* Conversations Sidebar */}
      <div className={`w-full lg:w-80 bg-white border-r flex-shrink-0 ${
        conversationId ? 'hidden lg:flex' : 'flex'
      } flex-col`}>
        <div className='p-4 border-b bg-gradient-to-r from-teal-500 to-cyan-500'>
          <h2 className='text-xl font-bold text-white'>Сообщения</h2>
          <p className='text-teal-100 text-sm'>{conversations.length} диалогов</p>
        </div>

        <div className='flex-1 overflow-y-auto'>
          {conversations.map((conv) => {
            const isActive = conv.id === conversationId
            const unread = conv.unreadCount || 0
            const isAdminChat = conv.type === 'ADMIN_FEEDBACK' || conv.admin_id

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
                <div className='flex gap-3'>
                  {conv.listing?.images?.[0] ? (
                    <img
                      src={conv.listing.images[0]}
                      alt={conv.listing.title}
                      className='w-12 h-12 rounded-lg object-cover'
                    />
                  ) : (
                    <div className='w-12 h-12 rounded-lg bg-slate-200 flex items-center justify-center'>
                      {isAdminChat ? (
                        <Shield className='h-6 w-6 text-indigo-500' />
                      ) : (
                        <Building2 className='h-6 w-6 text-slate-400' />
                      )}
                    </div>
                  )}
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-start justify-between mb-1'>
                      <div className='flex items-center gap-2'>
                        <p className='font-semibold text-sm text-slate-900 truncate'>
                          {isAdminChat ? (
                            <span className='flex items-center gap-1'>
                              <Shield className='h-3 w-3 text-indigo-500' />
                              {conv.admin_name || 'Администратор'}
                            </span>
                          ) : (
                            conv.renter_name || 'Клиент'
                          )}
                        </p>
                      </div>
                      {unread > 0 && (
                        <Badge className='bg-red-500 text-white ml-2 shrink-0'>
                          {unread}
                        </Badge>
                      )}
                    </div>
                    {conv.listing?.title && (
                      <p className='text-xs text-slate-600 truncate mb-1'>
                        {conv.listing.title}
                      </p>
                    )}
                    <p className='text-xs text-slate-500 truncate flex items-center gap-1'>
                      {conv.lastMessage?.type === 'REJECTION' && (
                        <AlertTriangle className='h-3 w-3 text-red-500' />
                      )}
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
        <div className='flex-1 flex flex-col'>
          {/* Chat Header */}
          <div className='bg-white border-b p-4'>
            <div className='flex items-center gap-3'>
              <Button
                variant='ghost'
                size='icon'
                className='lg:hidden'
                onClick={() => router.push('/partner/messages')}
              >
                <ArrowLeft className='h-5 w-5' />
              </Button>
              <div className='flex-1'>
                <h3 className='font-semibold text-slate-900 flex items-center gap-2'>
                  {selectedConv.admin_id ? (
                    <>
                      <Shield className='h-4 w-4 text-indigo-500' />
                      {selectedConv.admin_name || 'Администратор FunnyRent'}
                    </>
                  ) : (
                    selectedConv.renter_name || 'Клиент'
                  )}
                </h3>
                <p className='text-sm text-slate-600'>
                  {listing?.title || selectedConv.type}
                </p>
              </div>
            </div>
          </div>

          {/* Listing Context Card */}
          {listing && (
            <div className='bg-white border-b p-4'>
              <div className='flex gap-3 p-3 bg-slate-50 rounded-lg'>
                {listing.images?.[0] ? (
                  <img 
                    src={listing.images[0]} 
                    alt={listing.title}
                    className='w-16 h-16 rounded-lg object-cover'
                  />
                ) : (
                  <div className='w-16 h-16 bg-slate-200 rounded-lg flex items-center justify-center'>
                    <Building2 className='h-8 w-8 text-slate-400' />
                  </div>
                )}
                <div>
                  <p className='font-medium text-slate-900'>{listing.title}</p>
                  <p className='text-sm text-slate-600'>{listing.district}</p>
                  <p className='text-sm font-semibold text-teal-600'>
                    {listing.base_price_thb?.toLocaleString()} THB/day
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className='flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50'>
            {messages.map((msg) => {
              const isOwn = msg.sender_id === user?.id
              const isAdmin = msg.sender_role === 'ADMIN'
              const isRejection = msg.type === 'REJECTION'

              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <Avatar className='w-8 h-8 flex-shrink-0'>
                    <AvatarFallback className={
                      isOwn 
                        ? 'bg-teal-100 text-teal-700' 
                        : isAdmin 
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-slate-200'
                    }>
                      {isAdmin ? (
                        <Shield className='h-4 w-4' />
                      ) : (
                        msg.sender_name?.[0]?.toUpperCase() || 'U'
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-md`}>
                    {!isOwn && (
                      <span className='text-xs text-slate-500 mb-1 flex items-center gap-1'>
                        {isAdmin && <Shield className='h-3 w-3 text-indigo-500' />}
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
                        <div className='flex items-center gap-2 mb-2 pb-2 border-b border-red-200'>
                          <AlertTriangle className='h-4 w-4 text-red-500' />
                          <span className='font-semibold text-sm'>Listing Rejected</span>
                        </div>
                      )}
                      <p className='text-sm whitespace-pre-wrap break-words'>
                        {msg.message}
                      </p>
                    </div>
                    <div className='flex items-center gap-1 mt-1'>
                      <span className='text-xs text-slate-500'>
                        {msg.created_at && formatDistanceToNow(new Date(msg.created_at), {
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

          {/* Message Input */}
          <div className='bg-white border-t p-4'>
            <form onSubmit={sendMessage} className='flex gap-2'>
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder='Type a message...'
                className='flex-1'
                disabled={sending}
              />
              <Button
                type='submit'
                disabled={!newMessage.trim() || sending}
                className='bg-teal-600 hover:bg-teal-700 flex-shrink-0'
              >
                {sending ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : (
                  <Send className='h-4 w-4' />
                )}
              </Button>
            </form>
          </div>
        </div>
      ) : (
        <div className='flex-1 hidden lg:flex items-center justify-center bg-slate-50'>
          <div className='text-center'>
            <MessageSquare className='h-16 w-16 text-slate-300 mx-auto mb-4' />
            <h3 className='text-xl font-semibold text-slate-900 mb-2'>
              Select a conversation
            </h3>
            <p className='text-slate-600'>
              Choose a conversation from the list
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
