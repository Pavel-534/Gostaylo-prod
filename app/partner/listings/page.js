'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Eye, Edit, Trash2, Send, Loader2, AlertCircle, ExternalLink, ChevronRight } from 'lucide-react'
import { formatPrice } from '@/lib/currency'
import { useToast } from '@/hooks/use-toast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const SUPABASE_URL = 'https://vtzzcdsjwudkaloxhvnw.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyOTEzNSwiZXhwIjoyMDg3NjA1MTM1fQ.KqUyt_yX_Ts45MyOKtZ532-UXbgU9WVvwOtnN94zG8I'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjkxMzUsImV4cCI6MjA4NzYwNTEzNX0.vSrBY_n8_KqAi0yzN-g9LZqTkbbjloSakXq5o_28r4k'
const STORAGE_BUCKET = 'listings'
const TELEGRAM_BOT_TOKEN = '8702569258:AAFuj-Ob9otOVf6KiABQSiiWC0-8_KvkFqM'
const TELEGRAM_ADMIN_GROUP_ID = '-1003832026983'
const TOPIC_ID_NEW_PARTNERS = 17

export default function PartnerListings() {
  const router = useRouter()
  const { toast } = useToast()
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState(null)
  const [publishingId, setPublishingId] = useState(null)

  useEffect(() => {
    loadListings()
  }, [])

  async function loadListings() {
    try {
      const storedUser = localStorage.getItem('funnyrent_user')
      const user = storedUser ? JSON.parse(storedUser) : null
      
      if (!user || !user.id) {
        setLoading(false)
        return
      }
      
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/listings?owner_id=eq.${user.id}&order=created_at.desc`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          }
        }
      )
      const data = await res.json()
      setListings(Array.isArray(data) ? data : [])
      setLoading(false)
    } catch (error) {
      console.error('Failed to load listings:', error)
      setLoading(false)
    }
  }

  // Check if listing can be published (ANY INACTIVE listing)
  function canPublish(listing) {
    return listing.status === 'INACTIVE'
  }

  // Check if listing has all required data for publishing
  function isReadyToPublish(listing) {
    const hasPrice = listing.base_price_thb > 0
    const hasImages = listing.images && listing.images.length > 0
    return hasPrice && hasImages
  }

  // Get validation errors
  function getValidationErrors(listing) {
    const errors = []
    if (!listing.base_price_thb || listing.base_price_thb <= 0) errors.push('Укажите цену')
    if (!listing.images || listing.images.length === 0) errors.push('Добавьте фото')
    return errors.join(', ')
  }

  // Publish listing to moderation
  async function publishListing(listing) {
    if (!isReadyToPublish(listing)) {
      toast({
        title: 'Невозможно опубликовать',
        description: getValidationErrors(listing),
        variant: 'destructive'
      })
      return
    }

    setPublishingId(listing.id)

    try {
      // Update status to PENDING
      const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${listing.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          status: 'PENDING',
          metadata: {
            ...(listing.metadata || {}),
            is_draft: false,
            needs_review: true,
            submitted_at: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
      })

      if (!updateRes.ok) throw new Error('Failed to update listing')

      // Send Telegram notification
      const adminMessage = `🔔 <b>НОВАЯ ЗАЯВКА НА МОДЕРАЦИЮ</b>\n\n` +
        `📝 <b>ID:</b> ${listing.id}\n` +
        `🏠 <b>Название:</b> ${listing.title || 'Без названия'}\n` +
        `💰 <b>Цена:</b> ฿${listing.base_price_thb?.toLocaleString() || 0}/день\n` +
        `📸 <b>Фото:</b> ${listing.images?.length || 0}\n` +
        `📍 <b>Район:</b> ${listing.district || 'Не указан'}\n\n` +
        `<i>Листинг готов к проверке</i>`

      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_ADMIN_GROUP_ID,
          message_thread_id: TOPIC_ID_NEW_PARTNERS,
          text: adminMessage,
          parse_mode: 'HTML'
        })
      })

      // Update local state
      setListings(prev => prev.map(l => 
        l.id === listing.id 
          ? { ...l, status: 'PENDING', metadata: { ...l.metadata, is_draft: false } }
          : l
      ))

      toast({
        title: 'Отправлено на модерацию',
        description: 'Администратор проверит ваш листинг в ближайшее время',
      })
    } catch (error) {
      console.error('Failed to publish:', error)
      toast({
        title: 'Ошибка публикации',
        description: 'Попробуйте ещё раз',
        variant: 'destructive'
      })
    } finally {
      setPublishingId(null)
    }
  }

  // Delete listing with storage cleanup
  async function deleteListing(id) {
    try {
      const listingToDelete = listings.find(l => l.id === id)
      
      // Clean up storage
      if (listingToDelete?.images?.length > 0) {
        const filePaths = listingToDelete.images
          .filter(url => url && url.includes(`/storage/v1/object/public/${STORAGE_BUCKET}/`))
          .map(url => {
            const match = url.match(new RegExp(`/${STORAGE_BUCKET}/(.+)$`))
            return match ? match[1] : null
          })
          .filter(Boolean)
        
        if (filePaths.length > 0) {
          await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}`, {
            method: 'DELETE',
            headers: {
              'apikey': SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prefixes: filePaths })
          })
        }
      }
      
      // Delete from DB
      await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${id}`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      })
      
      setListings(listings.filter(l => l.id !== id))
      setDeleteId(null)
      
      toast({ title: 'Удалено', description: 'Листинг успешно удалён' })
    } catch (error) {
      console.error('Failed to delete:', error)
      toast({ title: 'Ошибка', description: 'Не удалось удалить', variant: 'destructive' })
    }
  }

  // Status config
  const statusConfig = {
    ACTIVE: { label: 'Активный', color: 'bg-green-100 text-green-700 border-green-200' },
    PENDING: { label: 'На модерации', color: 'bg-amber-100 text-amber-700 border-amber-200' },
    INACTIVE: { label: 'Черновик', color: 'bg-slate-100 text-slate-600 border-slate-300 border-dashed' },
    REJECTED: { label: 'Отклонён', color: 'bg-red-100 text-red-700 border-red-200' },
    BOOKED: { label: 'Забронирован', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  }

  // Get effective status (handle metadata.is_draft)
  function getStatus(listing) {
    if (listing.metadata?.is_draft === true) return 'INACTIVE'
    return listing.status || 'INACTIVE'
  }

  // Stats calculation
  const stats = {
    total: listings.length,
    active: listings.filter(l => l.status === 'ACTIVE').length,
    views: listings.reduce((sum, l) => sum + (l.views || 0), 0),
    bookings: listings.reduce((sum, l) => sum + (l.bookingsCount || 0), 0),
  }

  if (loading) {
    return (
      <div className='flex items-center justify-center min-h-[60vh]'>
        <Loader2 className='h-8 w-8 animate-spin text-teal-600' />
      </div>
    )
  }

  return (
    <div className='max-w-full overflow-x-hidden'>
      {/* Header - Mobile optimized */}
      <div className='px-4 py-4 bg-white border-b sticky top-0 z-10'>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-lg font-bold text-slate-900'>Мои листинги</h1>
            <p className='text-xs text-slate-500'>{stats.total} объектов</p>
          </div>
          <Button 
            asChild 
            size='sm'
            className='bg-teal-600 hover:bg-teal-700'
            data-testid='add-listing-btn'
          >
            <Link href='/partner/listings/new'>
              <Plus className='h-4 w-4 mr-1' />
              Добавить
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats - 2x2 grid on mobile */}
      <div className='grid grid-cols-2 gap-2 p-4'>
        <div className='bg-white rounded-lg p-3 border'>
          <div className='text-xl font-bold text-slate-900'>{stats.total}</div>
          <div className='text-xs text-slate-500'>Всего</div>
        </div>
        <div className='bg-white rounded-lg p-3 border'>
          <div className='text-xl font-bold text-green-600'>{stats.active}</div>
          <div className='text-xs text-slate-500'>Активных</div>
        </div>
        <div className='bg-white rounded-lg p-3 border'>
          <div className='text-xl font-bold text-slate-900'>{stats.views}</div>
          <div className='text-xs text-slate-500'>Просмотров</div>
        </div>
        <div className='bg-white rounded-lg p-3 border'>
          <div className='text-xl font-bold text-slate-900'>{stats.bookings}</div>
          <div className='text-xs text-slate-500'>Бронирований</div>
        </div>
      </div>

      {/* Listings */}
      <div className='px-4 pb-4 space-y-3'>
        {listings.length === 0 ? (
          <Card className='border-dashed'>
            <CardContent className='flex flex-col items-center justify-center py-12'>
              <div className='w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mb-3'>
                <Plus className='h-6 w-6 text-slate-400' />
              </div>
              <h3 className='text-base font-semibold text-slate-900 mb-1'>
                Нет листингов
              </h3>
              <p className='text-sm text-slate-500 mb-4 text-center'>
                Добавьте первое предложение
              </p>
              <Button asChild className='bg-teal-600 hover:bg-teal-700'>
                <Link href='/partner/listings/new'>
                  <Plus className='h-4 w-4 mr-2' />
                  Создать листинг
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          listings.map((listing) => {
            const status = getStatus(listing)
            const config = statusConfig[status] || statusConfig.INACTIVE
            const isInactive = status === 'INACTIVE'
            const ready = isReadyToPublish(listing)
            
            return (
              <Card 
                key={listing.id} 
                className='overflow-hidden active:bg-slate-50 transition-colors'
                data-testid={`listing-card-${listing.id}`}
              >
                {/* Clickable card body - navigates to edit */}
                <Link 
                  href={`/partner/listings/${listing.id}`}
                  className='block'
                >
                  <div className='flex p-3 gap-3'>
                    {/* Image */}
                    <div className='relative w-20 h-20 flex-shrink-0'>
                      <img
                        src={listing.images?.[0] || listing.cover_image || '/placeholder.jpg'}
                        alt={listing.title}
                        className='w-full h-full object-cover rounded-lg'
                      />
                      {listing.images?.length > 1 && (
                        <span className='absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1 rounded'>
                          +{listing.images.length - 1}
                        </span>
                      )}
                    </div>
                    
                    {/* Info */}
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-start justify-between gap-2'>
                        <h3 className='font-medium text-slate-900 text-sm line-clamp-1'>
                          {listing.title || 'Без названия'}
                        </h3>
                        <ChevronRight className='h-4 w-4 text-slate-400 flex-shrink-0' />
                      </div>
                      
                      <p className='text-xs text-slate-500 mt-0.5'>
                        {listing.district || 'Район не указан'}
                      </p>
                      
                      <div className='flex items-center gap-2 mt-1.5'>
                        <span className='font-semibold text-sm text-slate-900'>
                          {listing.base_price_thb > 0 
                            ? `฿${listing.base_price_thb.toLocaleString()}` 
                            : 'Цена не указана'}
                        </span>
                        <span className='text-xs text-slate-400'>/день</span>
                      </div>
                      
                      <div className='flex items-center gap-3 mt-1.5 text-xs text-slate-500'>
                        <span className='flex items-center gap-1'>
                          <Eye className='h-3 w-3' />
                          {listing.views || 0}
                        </span>
                        <Badge className={`text-[10px] px-1.5 py-0 h-5 border ${config.color}`}>
                          {config.label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </Link>
                
                {/* Action buttons row - always visible */}
                <div className='px-3 pb-3 flex gap-2'>
                  {/* PUBLISH BUTTON - for ANY INACTIVE listing */}
                  {isInactive && (
                    <Button
                      onClick={(e) => {
                        e.preventDefault()
                        publishListing(listing)
                      }}
                      disabled={!ready || publishingId === listing.id}
                      className={`flex-1 h-9 text-sm ${ready 
                        ? 'bg-teal-600 hover:bg-teal-700 text-white' 
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                      data-testid={`publish-btn-${listing.id}`}
                    >
                      {publishingId === listing.id ? (
                        <Loader2 className='h-4 w-4 animate-spin' />
                      ) : !ready ? (
                        <>
                          <AlertCircle className='h-4 w-4 mr-1' />
                          <span className='truncate'>Заполните данные</span>
                        </>
                      ) : (
                        <>
                          <Send className='h-4 w-4 mr-1' />
                          Опубликовать
                        </>
                      )}
                    </Button>
                  )}
                  
                  {/* View on site button */}
                  <Button
                    variant='outline'
                    size='sm'
                    className='h-9'
                    asChild
                  >
                    <Link href={`/listings/${listing.id}`} target='_blank'>
                      <ExternalLink className='h-4 w-4' />
                    </Link>
                  </Button>
                  
                  {/* Edit button */}
                  <Button
                    variant='outline'
                    size='sm'
                    className='h-9'
                    asChild
                  >
                    <Link href={`/partner/listings/${listing.id}`}>
                      <Edit className='h-4 w-4' />
                    </Link>
                  </Button>
                  
                  {/* Delete button */}
                  <Button
                    variant='outline'
                    size='sm'
                    className='h-9 text-red-600 hover:text-red-700 hover:bg-red-50'
                    onClick={(e) => {
                      e.preventDefault()
                      setDeleteId(listing.id)
                    }}
                    data-testid={`delete-btn-${listing.id}`}
                  >
                    <Trash2 className='h-4 w-4' />
                  </Button>
                </div>
              </Card>
            )
          })
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className='mx-4 max-w-[calc(100vw-2rem)]'>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить листинг?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className='flex-row gap-2'>
            <AlertDialogCancel className='flex-1 m-0'>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteListing(deleteId)}
              className='flex-1 m-0 bg-red-600 hover:bg-red-700'
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
