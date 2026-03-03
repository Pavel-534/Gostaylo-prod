'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel'
import { useToast } from '@/hooks/use-toast'
import { 
  CheckCircle, XCircle, Loader2, Building2, User, Clock, 
  Mail, Star, AlertTriangle, Eye, MapPin, DollarSign, Percent,
  MessageSquare, Send, ChevronLeft, ChevronRight, X, Sparkles
} from 'lucide-react'

const SUPABASE_URL = 'https://vtzzcdsjwudkaloxhvnw.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyOTEzNSwiZXhwIjoyMDg3NjA1MTM1fQ.KqUyt_yX_Ts45MyOKtZ532-UXbgU9WVvwOtnN94zG8I'
const TELEGRAM_BOT_TOKEN = '8702569258:AAFuj-Ob9otOVf6KiABQSiiWC0-8_KvkFqM'

export default function ModerationPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('listings')
  const [pendingListings, setPendingListings] = useState([])
  const [pendingPartners, setPendingPartners] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedListing, setSelectedListing] = useState(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectingListing, setRejectingListing] = useState(null)
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const headers = {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
    }

    try {
      // Load pending listings (only PENDING, exclude drafts)
      // Draft listings have metadata->is_draft = true, filter them out
      const listingsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/listings?status=eq.PENDING&order=created_at.desc&select=*`,
        { headers }
      )
      const rawListings = await listingsRes.json()
      
      // Filter out draft listings (metadata.is_draft = true)
      const filteredListings = (rawListings || []).filter(listing => {
        const isDraft = listing.metadata?.is_draft === true
        return !isDraft
      })
      setPendingListings(filteredListings)

      // Load pending partners (users with metadata.partner_status = PENDING)
      // Since role_status column doesn't exist, we query all profiles and filter client-side
      const partnersRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?select=*&order=updated_at.desc`,
        { headers }
      )
      const allProfiles = await partnersRes.json()
      // Filter for pending partner applications (stored in metadata)
      const pendingPartnersList = Array.isArray(allProfiles) 
        ? allProfiles.filter(p => p.metadata?.partner_status === 'PENDING')
        : []
      setPendingPartners(pendingPartnersList)
    } catch (error) {
      console.error('Error loading data:', error)
      toast({ title: 'Ошибка', description: 'Не удалось загрузить данные', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  async function handleApproveListing(listingId) {
    setProcessing(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          status: 'ACTIVE',  // Valid enum value (uppercase)
          available: true,
          updated_at: new Date().toISOString()
        })
      })

      if (res.ok) {
        toast({ title: 'Одобрено', description: 'Объявление опубликовано' })
        setSelectedListing(null)
        loadData()
      }
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось одобрить', variant: 'destructive' })
    } finally {
      setProcessing(false)
    }
  }

  async function openRejectModal(listing) {
    setRejectingListing(listing)
    setRejectReason('')
    setShowRejectModal(true)
  }

  async function handleRejectListing() {
    if (!rejectingListing || !rejectReason.trim()) {
      toast({ title: 'Ошибка', description: 'Укажите причину отклонения', variant: 'destructive' })
      return
    }

    setProcessing(true)
    const listing = rejectingListing

    try {
      // 1. Update listing status
      const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${listing.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'REJECTED',  // Valid enum value (uppercase)
          available: false,
          rejection_reason: rejectReason,
          rejected_at: new Date().toISOString(),
          metadata: {
            ...(listing.metadata || {}),
            is_rejected: true,
            rejection_reason: rejectReason,
            rejected_at: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
      })

      // 2. Get partner info
      let partnerTelegramId = null
      let partnerName = 'Партнёр'
      
      if (listing.owner_id) {
        const partnerRes = await fetch(
          `${SUPABASE_URL}/rest/v1/profiles?id=eq.${listing.owner_id}&select=telegram_id,name,email`,
          { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
        )
        const partnerData = await partnerRes.json()
        if (partnerData?.[0]) {
          partnerTelegramId = partnerData[0].telegram_id
          partnerName = partnerData[0].name || partnerData[0].email || 'Партнёр'
        }
      }

      // 3. Create internal message
      const conversationId = `conv-reject-${listing.id}-${Date.now()}`
      
      // Create conversation
      await fetch(`${SUPABASE_URL}/rest/v1/conversations`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: conversationId,
          listing_id: listing.id,
          partner_id: listing.owner_id,
          partner_name: partnerName,
          admin_id: 'admin',
          admin_name: 'Модератор FunnyRent',
          type: 'ADMIN_FEEDBACK',
          status: 'OPEN',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      })

      // Create message
      await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: `msg-${Date.now()}`,
          conversation_id: conversationId,
          sender_id: 'admin',
          sender_role: 'ADMIN',
          sender_name: 'Модератор FunnyRent',
          message: `Ваше объявление "${listing.title}" было отклонено.\n\nПричина: ${rejectReason}\n\nПожалуйста, исправьте указанные проблемы и отправьте на повторную модерацию.`,
          type: 'REJECTION',
          is_read: false,
          created_at: new Date().toISOString()
        })
      })

      // 4. Send Telegram notification if partner has telegram_id
      let telegramSent = false
      if (partnerTelegramId) {
        try {
          const tgRes = await fetch(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: partnerTelegramId,
                text: `❌ <b>Объявление отклонено</b>\n\n📍 <b>${listing.title}</b>\n\n📝 <b>Причина:</b>\n${rejectReason}\n\n<i>Исправьте замечания и отправьте повторно</i>`,
                parse_mode: 'HTML'
              })
            }
          )
          telegramSent = tgRes.ok
        } catch (tgError) {
          console.error('Telegram error:', tgError)
        }
      }

      // 5. Show result
      if (telegramSent) {
        toast({ 
          title: 'Отклонено', 
          description: 'Уведомление отправлено в Telegram и внутренний чат' 
        })
      } else {
        toast({ 
          title: 'Отклонено', 
          description: partnerTelegramId 
            ? 'Ошибка Telegram, но сообщение сохранено во внутренний чат'
            : 'Партнёр не привязал Telegram. Уведомление только во внутреннем чате',
          variant: partnerTelegramId ? 'destructive' : 'default'
        })
      }

      setShowRejectModal(false)
      setSelectedListing(null)
      setRejectingListing(null)
      loadData()
    } catch (error) {
      console.error('Reject error:', error)
      toast({ title: 'Ошибка', description: 'Не удалось отклонить', variant: 'destructive' })
    } finally {
      setProcessing(false)
    }
  }

  async function handleToggleFeatured(listingId, currentStatus) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_featured: !currentStatus })
      })

      if (res.ok) {
        toast({ title: currentStatus ? 'Убрано из рекомендаций' : 'Добавлено в рекомендации' })
        // Update local state
        setPendingListings(prev => 
          prev.map(l => l.id === listingId ? { ...l, is_featured: !currentStatus } : l)
        )
        if (selectedListing?.id === listingId) {
          setSelectedListing({ ...selectedListing, is_featured: !currentStatus })
        }
      }
    } catch (error) {
      toast({ title: 'Ошибка', variant: 'destructive' })
    }
  }

  async function handleApprovePartner(partnerId) {
    setProcessing(true)
    try {
      // Get partner data first
      const partnerRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${partnerId}&select=*`, {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      })
      const partners = await partnerRes.json()
      const partner = partners?.[0]
      
      // Update profile: role = PARTNER, store approval in metadata
      const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${partnerId}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          role: 'PARTNER',
          is_verified: true,
          metadata: {
            ...(partner?.metadata || {}),
            partner_status: 'APPROVED',
            partner_approved_at: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
      })

      if (res.ok) {
        toast({ title: 'Партнёр одобрен!', description: 'Email уведомление отправлено' })
        loadData()
        
        // Send email notification via API
        if (partner?.email) {
          await fetch('/api/notifications/partner-approved', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              partnerId, 
              email: partner.email,
              name: partner.first_name || partner.name
            })
          }).catch(e => console.log('Email API error:', e))
        }
        
        // Send Telegram notification
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: '-1003832026983',
            message_thread_id: 17,
            text: `✅ <b>ПАРТНЁР ОДОБРЕН</b>\n\n` +
              `👤 ${partner?.first_name || ''} ${partner?.last_name || ''}\n` +
              `📧 ${partner?.email}\n` +
              `📞 ${partner?.phone || 'N/A'}\n\n` +
              `<i>Теперь может размещать объекты</i>`,
            parse_mode: 'HTML'
          })
        })
      }
    } catch (error) {
      console.error('Error approving partner:', error)
      toast({ title: 'Ошибка', variant: 'destructive' })
    } finally {
      setProcessing(false)
    }
  }

  async function handleRejectPartner(partnerId, reason = 'Не соответствует требованиям') {
    setProcessing(true)
    try {
      // Get partner data
      const partnerRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${partnerId}&select=*`, {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      })
      const partners = await partnerRes.json()
      const partner = partners?.[0]
      
      // Update profile: store rejection in metadata
      const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${partnerId}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          metadata: {
            ...(partner?.metadata || {}),
            partner_status: 'REJECTED',
            partner_rejected_at: new Date().toISOString(),
            rejection_reason: reason
          },
          updated_at: new Date().toISOString()
        })
      })

      if (res.ok) {
        toast({ title: 'Заявка отклонена' })
        loadData()
      }
    } catch (error) {
      console.error('Error rejecting partner:', error)
      toast({ title: 'Ошибка', variant: 'destructive' })
    } finally {
      setProcessing(false)
    }
  }

  async function openMessageModal() {
    setMessageText('')
    setShowMessageModal(true)
  }

  async function handleSendMessage() {
    if (!selectedListing || !messageText.trim()) return

    setProcessing(true)
    try {
      const conversationId = `conv-admin-${selectedListing.id}-${Date.now()}`
      
      // Create or find conversation
      await fetch(`${SUPABASE_URL}/rest/v1/conversations`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: conversationId,
          listing_id: selectedListing.id,
          partner_id: selectedListing.owner_id,
          admin_id: 'admin',
          admin_name: 'Администратор',
          type: 'ADMIN_FEEDBACK',
          status: 'OPEN',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      })

      // Create message
      await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: `msg-${Date.now()}`,
          conversation_id: conversationId,
          sender_id: 'admin',
          sender_role: 'ADMIN',
          sender_name: 'Администратор',
          message: messageText,
          type: 'TEXT',
          is_read: false,
          created_at: new Date().toISOString()
        })
      })

      toast({ title: 'Сообщение отправлено', description: 'Партнёр увидит его в личном кабинете' })
      setShowMessageModal(false)
      setMessageText('')
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось отправить', variant: 'destructive' })
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 lg:mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">Модерация</h1>
          <p className="text-slate-600 mt-1">Проверка объявлений и партнёров</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6">
          <Card className="bg-white/80 backdrop-blur border-orange-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-orange-600">{pendingListings.length}</p>
                  <p className="text-xs text-slate-600">Объявлений</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/80 backdrop-blur border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <User className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-600">{pendingPartners.length}</p>
                  <p className="text-xs text-slate-600">Партнёров</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-white/80 backdrop-blur p-1">
            <TabsTrigger value="listings" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
              <Building2 className="h-4 w-4 mr-2" />
              Объявления ({pendingListings.length})
            </TabsTrigger>
            <TabsTrigger value="partners" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
              <User className="h-4 w-4 mr-2" />
              Партнёры ({pendingPartners.length})
            </TabsTrigger>
          </TabsList>

          {/* Listings Tab */}
          <TabsContent value="listings" className="space-y-4">
            {pendingListings.length === 0 ? (
              <Card className="bg-white/80 backdrop-blur">
                <CardContent className="p-8 text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900">Всё проверено!</h3>
                  <p className="text-slate-600">Нет объявлений на модерации</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pendingListings.map((listing) => (
                  <Card 
                    key={listing.id} 
                    className="bg-white/90 backdrop-blur overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
                    onClick={() => setSelectedListing(listing)}
                  >
                    {/* Image */}
                    <div className="relative aspect-[4/3] overflow-hidden">
                      {listing.images?.[0] ? (
                        <img
                          src={listing.images[0]}
                          alt={listing.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-200 flex items-center justify-center">
                          <Building2 className="h-12 w-12 text-slate-400" />
                        </div>
                      )}
                      
                      {/* Badges */}
                      <div className="absolute top-2 left-2 flex gap-2">
                        <Badge className="bg-orange-500">На проверке</Badge>
                        {listing.is_featured && (
                          <Badge className="bg-purple-500">
                            <Star className="h-3 w-3 mr-1" fill="white" />
                            Рекомендуем
                          </Badge>
                        )}
                      </div>
                      
                      {/* Photo count */}
                      <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                        {listing.images?.length || 0} фото
                      </div>
                    </div>
                    
                    {/* Content */}
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-slate-900 line-clamp-1 mb-1">
                        {listing.title || 'Без названия'}
                      </h3>
                      <p className="text-sm text-slate-600 flex items-center gap-1 mb-2">
                        <MapPin className="h-3 w-3" />
                        {listing.district || 'Район не указан'}
                      </p>
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-indigo-600">
                          ฿{listing.base_price_thb?.toLocaleString() || 0}/день
                        </p>
                        <p className="text-xs text-slate-500">
                          {listing.created_at ? new Date(listing.created_at).toLocaleDateString('ru-RU') : '-'}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Partners Tab */}
          <TabsContent value="partners" className="space-y-4">
            {pendingPartners.length === 0 ? (
              <Card className="bg-white/80 backdrop-blur">
                <CardContent className="p-8 text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900">Все партнёры проверены!</h3>
                  <p className="text-slate-600">Нет заявок на верификацию</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {pendingPartners.map((partner) => (
                  <Card key={partner.id} className="bg-white/90 backdrop-blur">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                            <span className="text-lg font-bold text-indigo-600">
                              {(partner.name || 'P').charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{partner.name || 'Без имени'}</p>
                            <p className="text-sm text-slate-600 flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {partner.email || '-'}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleApprovePartner(partner.id)}
                            className="bg-green-600 hover:bg-green-700"
                            size="sm"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Одобрить
                          </Button>
                          <Button
                            onClick={() => handleRejectPartner(partner.id)}
                            variant="destructive"
                            size="sm"
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Отклонить
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Detailed View Modal - Mobile First Design */}
      <Dialog open={!!selectedListing} onOpenChange={() => setSelectedListing(null)}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto p-0 gap-0 [&>button]:hidden">
          {selectedListing && (
            <>
              {/* Image Carousel */}
              <div className="relative bg-slate-900">
                {selectedListing.images?.length > 0 ? (
                  <Carousel className="w-full">
                    <CarouselContent>
                      {selectedListing.images.map((img, idx) => (
                        <CarouselItem key={idx}>
                          <div className="aspect-[16/10] md:aspect-[16/9]">
                            <img
                              src={img}
                              alt={`Фото ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    <CarouselPrevious className="left-4 bg-white/90 hover:bg-white z-10" />
                    <CarouselNext className="right-14 bg-white/90 hover:bg-white z-10" />
                    {/* Photo counter */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-3 py-1 rounded-full z-10">
                      {selectedListing.images.length} фото
                    </div>
                  </Carousel>
                ) : (
                  <div className="aspect-[16/10] bg-slate-200 flex items-center justify-center">
                    <Building2 className="h-16 w-16 text-slate-400" />
                  </div>
                )}
                
                {/* Close button - single, clear button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-3 right-3 bg-white/90 hover:bg-white rounded-full z-20 shadow-lg"
                  onClick={() => setSelectedListing(null)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Content */}
              <div className="p-4 md:p-6 space-y-4">
                {/* Title & Badge */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">
                      {selectedListing.title || 'Без названия'}
                    </h2>
                    <p className="text-slate-600 flex items-center gap-1 mt-1">
                      <MapPin className="h-4 w-4" />
                      {selectedListing.district || 'Район не указан'}
                    </p>
                  </div>
                  <Badge className="bg-orange-500 shrink-0">На проверке</Badge>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-3 md:p-4">
                    <div className="flex items-center gap-2 text-indigo-600 mb-1">
                      <DollarSign className="h-4 w-4" />
                      <span className="text-xs font-medium">Цена</span>
                    </div>
                    <p className="text-lg md:text-xl font-bold text-indigo-700">
                      ฿{selectedListing.base_price_thb?.toLocaleString() || 0}
                    </p>
                    <p className="text-xs text-indigo-600">/день</p>
                  </div>
                  
                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-3 md:p-4">
                    <div className="flex items-center gap-2 text-green-600 mb-1">
                      <Percent className="h-4 w-4" />
                      <span className="text-xs font-medium">Комиссия</span>
                    </div>
                    <p className="text-lg md:text-xl font-bold text-green-700">
                      {selectedListing.commission_rate || 15}%
                    </p>
                    <p className="text-xs text-green-600">стандарт</p>
                  </div>
                  
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-3 md:p-4">
                    <div className="flex items-center gap-2 text-purple-600 mb-1">
                      <Clock className="h-4 w-4" />
                      <span className="text-xs font-medium">Создано</span>
                    </div>
                    <p className="text-sm md:text-base font-bold text-purple-700">
                      {selectedListing.created_at 
                        ? new Date(selectedListing.created_at).toLocaleDateString('ru-RU')
                        : '-'}
                    </p>
                  </div>
                  
                  <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-3 md:p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-amber-600">
                        <Sparkles className="h-4 w-4" />
                        <span className="text-xs font-medium">Рекомендуем</span>
                      </div>
                      <Switch
                        checked={selectedListing.is_featured || false}
                        onCheckedChange={() => handleToggleFeatured(selectedListing.id, selectedListing.is_featured)}
                        className="data-[state=checked]:bg-amber-500"
                      />
                    </div>
                    <p className="text-sm font-bold text-amber-700">
                      {selectedListing.is_featured ? 'В рекомендациях' : 'Не в рекомендациях'}
                    </p>
                  </div>
                </div>

                {/* Description */}
                {selectedListing.description && (
                  <div className="bg-slate-50 rounded-xl p-4">
                    <h3 className="font-semibold text-slate-900 mb-2">Описание</h3>
                    <p className="text-slate-600 text-sm whitespace-pre-wrap">
                      {selectedListing.description}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                  <Button
                    onClick={() => handleApproveListing(selectedListing.id)}
                    className="flex-1 bg-green-600 hover:bg-green-700 h-12 text-base"
                    disabled={processing}
                  >
                    {processing ? (
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    ) : (
                      <CheckCircle className="h-5 w-5 mr-2" />
                    )}
                    Одобрить
                  </Button>
                  
                  <Button
                    onClick={() => openRejectModal(selectedListing)}
                    variant="destructive"
                    className="flex-1 h-12 text-base"
                    disabled={processing}
                  >
                    <XCircle className="h-5 w-5 mr-2" />
                    Отклонить
                  </Button>
                  
                  <Button
                    onClick={openMessageModal}
                    variant="outline"
                    className="flex-1 h-12 text-base border-indigo-300 text-indigo-600 hover:bg-indigo-50"
                    disabled={processing}
                  >
                    <MessageSquare className="h-5 w-5 mr-2" />
                    Написать владельцу
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Отклонение объявления
            </DialogTitle>
            <DialogDescription>
              Укажите причину отклонения. Партнёр получит уведомление.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="rejectReason">Причина отклонения</Label>
              <Textarea
                id="rejectReason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Опишите, что нужно исправить..."
                className="mt-2 min-h-[120px]"
              />
            </div>
            
            {/* Quick reasons */}
            <div className="flex flex-wrap gap-2">
              {[
                'Некачественные фото',
                'Неполное описание',
                'Неверная цена',
                'Дубликат'
              ].map(reason => (
                <Badge 
                  key={reason}
                  variant="outline" 
                  className="cursor-pointer hover:bg-slate-100"
                  onClick={() => setRejectReason(prev => prev ? `${prev}\n• ${reason}` : `• ${reason}`)}
                >
                  + {reason}
                </Badge>
              ))}
            </div>
          </div>
          
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowRejectModal(false)}
              disabled={processing}
            >
              Отмена
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleRejectListing}
              disabled={processing || !rejectReason.trim()}
            >
              {processing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Отклонить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Message Modal */}
      <Dialog open={showMessageModal} onOpenChange={setShowMessageModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-indigo-600" />
              Написать владельцу
            </DialogTitle>
            <DialogDescription>
              Сообщение будет отправлено во внутренний чат партнёра
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Ваше сообщение партнёру..."
              className="min-h-[120px]"
            />
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowMessageModal(false)}
              disabled={processing}
            >
              Отмена
            </Button>
            <Button 
              onClick={handleSendMessage}
              disabled={processing || !messageText.trim()}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {processing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Отправить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
