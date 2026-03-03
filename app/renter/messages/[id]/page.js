'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Send, Loader2, ArrowLeft, Image as ImageIcon, Smile, Home, Shield, Wifi, WifiOff, CreditCard } from 'lucide-react'
import { ListingContextCard } from '@/components/listing-context-card'
import { BookingRequestCard, SystemMessage } from '@/components/booking-request-card'
import { detectUnsafePatterns, SafetyBanner, RiskIndicator } from '@/components/chat-safety'
import { InvoiceCard } from '@/components/chat-invoice'
import { useRealtimeMessages, usePresence, playNotificationSound } from '@/hooks/use-realtime-chat'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import { toast } from 'sonner'
import Link from 'next/link'

export default function RenterMessages({ params }) {
  const router = useRouter()
  const messagesEndRef = useRef(null)
  const [conversations, setConversations] = useState([])
  const [selectedConv, setSelectedConv] = useState(null)
  const [messages, setMessages] = useState([])
  const [listing, setListing] = useState(null)
  const [bookingStatus, setBookingStatus] = useState(null)
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [safetyWarningShown, setSafetyWarningShown] = useState(false)
  const [detectedPatterns, setDetectedPatterns] = useState([])
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState(null)

  const renterId = 'renter-1'
  const conversationId = params?.id

  // Realtime message subscription
  const handleNewRealtimeMessage = useCallback((newMsg) => {
    // Only add if from other user (avoid duplicates from own sends)
    if (newMsg.sender_id !== renterId) {
      setMessages(prev => {
        if (prev.some(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      playNotificationSound();
      toast.info('💬 Новое сообщение');
    }
  }, [renterId]);

  const { isConnected } = useRealtimeMessages(conversationId, handleNewRealtimeMessage);
  const { isOnline: partnerOnline } = usePresence(conversationId, renterId);

  useEffect(() => {
    loadConversations()
  }, [])

  useEffect(() => {
    if (conversationId) {
      loadMessages(conversationId)
    }
  }, [conversationId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Check for unsafe patterns in messages
  useEffect(() => {
    if (messages.length > 0) {
      const allPatterns = []
      messages.forEach(msg => {
        const result = detectUnsafePatterns(msg.message || msg.content)
        if (result.hasRisk) {
          allPatterns.push(...result.patterns)
        }
      })
      if (allPatterns.length > 0 && !safetyWarningShown) {
        setDetectedPatterns(allPatterns)
      }
    }
  }, [messages, safetyWarningShown])

  async function loadConversations() {
    try {
      const res = await fetch(`/api/conversations?userId=${renterId}&role=RENTER`)
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
        
        const bookingRequestMsg = data.data.messages?.find(m => m.type === 'BOOKING_REQUEST')
        if (bookingRequestMsg?.bookingId) {
          fetchBookingStatus(bookingRequestMsg.bookingId)
        }
      }
    } catch (error) {
      console.error('Failed to load messages:', error)
    }
  }
  
  async function fetchBookingStatus(bookingId) {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/payment-status`)
      const data = await res.json()
      if (data.success && data.data.booking) {
        setBookingStatus(data.data.booking.status)
      }
    } catch (error) {
      console.error('Failed to fetch booking status:', error)
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
          senderId: renterId,
          senderRole: 'RENTER',
          senderName: 'Алексей Иванов',
          message: newMessage,
        }),
      })

      const data = await res.json()
      if (data.success) {
        setMessages([...messages, data.data])
        setNewMessage('')
        loadConversations()
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
    setTimeout(() => {
      loadMessages(conversationId)
      loadConversations()
    }, 500)
  }

  // Handle invoice payment - redirect to payment page
  function handlePayInvoice(invoice) {
    if (invoice?.booking_id) {
      router.push(`/checkout/${invoice.booking_id}`)
    } else {
      toast.error('Не удалось найти бронирование для оплаты')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">FR</span>
            </div>
            <span className="font-bold text-slate-900">FunnyRent</span>
          </Link>
          <Button asChild variant="ghost">
            <Link href="/">
              <Home className="h-4 w-4 mr-2" />
              На главную
            </Link>
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {conversations.length === 0 ? (
          <Card className="p-12">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                Нет активных диалогов
              </h3>
              <p className="text-slate-600 mb-6">
                Когда вы отправите запрос на бронирование, диалог появится здесь
              </p>
              <Button asChild className="bg-teal-600 hover:bg-teal-700">
                <Link href="/">Найти жильё</Link>
              </Button>
            </div>
          </Card>
        ) : !conversationId ? (
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Мои диалоги</h2>
            <div className="space-y-4">
              {conversations.map((conv) => {
                const unread = conv.unreadCountRenter || 0
                
                return (
                  <Card
                    key={conv.id}
                    className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => router.push(`/renter/messages/${conv.id}`)}
                  >
                    <div className="flex gap-4">
                      <img
                        src={conv.listing?.images?.[0] || '/placeholder.jpg'}
                        alt={conv.listing?.title}
                        className="w-20 h-20 rounded-lg object-cover"
                      />
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-slate-900">
                            {conv.listing?.title}
                          </h3>
                          {unread > 0 && (
                            <Badge className="bg-red-500 text-white ml-2">
                              {unread} новых
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 mb-2">
                          {conv.listing?.district}
                        </p>
                        <p className="text-sm text-slate-500 truncate">
                          {conv.lastMessage?.message || 'Новое сообщение'}
                        </p>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => router.push('/renter/messages')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Все диалоги
              </Button>
              
              {/* Connection Status */}
              <div className="flex items-center gap-3">
                {/* Partner Online Status */}
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${partnerOnline ? 'bg-green-500' : 'bg-slate-300'}`} />
                  <span className="text-xs text-slate-600">
                    {partnerOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                
                {/* Realtime Connection */}
                <div className={`flex items-center gap-1 text-xs ${isConnected ? 'text-green-600' : 'text-orange-500'}`}>
                  {isConnected ? (
                    <>
                      <Wifi className="h-3 w-3" />
                      <span>Live</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-3 w-3" />
                      <span>Connecting...</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <ListingContextCard listing={listing} />

            {bookingStatus === 'PAID' && listing?.categoryId !== '2' && (
              <Card className="bg-gradient-to-r from-teal-50 to-blue-50 border-teal-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🏍️</span>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">
                        Нужен транспорт?
                      </p>
                      <p className="text-sm text-slate-600">
                        Исследуйте нашу коллекцию байков и автомобилей!
                      </p>
                    </div>
                    <Button 
                      asChild 
                      size="sm"
                      className="bg-teal-600 hover:bg-teal-700"
                    >
                      <Link href="/?category=vehicles">
                        Vehicles
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Safety Warning Banner */}
            <SafetyBanner 
              patterns={detectedPatterns} 
              onDismiss={() => setSafetyWarningShown(true)}
              lang="ru"
            />

            <Card>
              <div className="h-[500px] overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => {
                  if (msg.type === 'BOOKING_REQUEST') {
                    return (
                      <BookingRequestCard
                        key={msg.id}
                        message={msg}
                        userRole="RENTER"
                        onStatusUpdate={handleBookingStatusUpdate}
                      />
                    )
                  }

                  if (msg.senderRole === 'SYSTEM') {
                    return <SystemMessage key={msg.id} message={msg} />
                  }

                  // Render Invoice Card from partner
                  const isInvoice = msg.type === 'INVOICE' || msg.metadata?.invoice
                  if (isInvoice && msg.metadata?.invoice) {
                    const isOwn = msg.senderId === renterId || msg.sender_id === renterId
                    return (
                      <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        <InvoiceCard
                          invoice={msg.metadata.invoice}
                          isOwn={isOwn}
                          paymentMethod={msg.metadata.invoice.payment_method}
                          onPay={handlePayInvoice}
                        />
                      </div>
                    )
                  }

                  const isOwn = msg.senderId === renterId || msg.sender_id === renterId
                  const isPartner = msg.senderRole === 'PARTNER' || msg.sender_role === 'PARTNER'

                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarFallback className={isPartner ? 'bg-teal-100 text-teal-700' : 'bg-slate-200'}>
                          {msg.senderName?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-md`}>
                        <div
                          className={`px-4 py-2 rounded-2xl ${
                            isOwn
                              ? 'bg-teal-600 text-white rounded-tr-none'
                              : 'bg-white text-slate-900 rounded-tl-none shadow-sm border'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {msg.message}
                          </p>
                        </div>
                        <span className="text-xs text-slate-500 mt-1">
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

              <div className="border-t p-4">
                <form onSubmit={sendMessage} className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0"
                  >
                    <ImageIcon className="h-5 w-5 text-slate-400" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0"
                  >
                    <Smile className="h-5 w-5 text-slate-400" />
                  </Button>
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
                    className="bg-teal-600 hover:bg-teal-700 flex-shrink-0"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
