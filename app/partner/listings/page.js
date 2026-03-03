'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Eye, Edit, Trash2, MoreVertical, Grid, List, ExternalLink, Send, Loader2, AlertCircle } from 'lucide-react'
import { formatPrice } from '@/lib/currency'
import { useToast } from '@/hooks/use-toast'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const SUPABASE_URL = 'https://vtzzcdsjwudkaloxhvnw.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyOTEzNSwiZXhwIjoyMDg3NjA1MTM1fQ.KqUyt_yX_Ts45MyOKtZ532-UXbgU9WVvwOtnN94zG8I'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjkxMzUsImV4cCI6MjA4NzYwNTEzNX0.vSrBY_n8_KqAi0yzN-g9LZqTkbbjloSakXq5o_28r4k'
const STORAGE_BUCKET = 'listings'
const TELEGRAM_BOT_TOKEN = '8702569258:AAFuj-Ob9otOVf6KiABQSiiWC0-8_KvkFqM'
const TELEGRAM_ADMIN_GROUP_ID = '-1003832026983'
const TOPIC_ID_NEW_PARTNERS = 17  // For moderation requests

export default function PartnerListings() {
  const { toast } = useToast()
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('grid')
  const [deleteId, setDeleteId] = useState(null)
  const [publishingId, setPublishingId] = useState(null)

  useEffect(() => {
    loadListings()
  }, [])

  async function loadListings() {
    try {
      // Get current user
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

  /**
   * Check if a listing is a draft that can be published
   */
  function isDraft(listing) {
    return listing.status === 'INACTIVE' && listing.metadata?.is_draft === true
  }

  /**
   * Check if draft can be published (has price and images)
   */
  function canPublishDraft(listing) {
    const hasPrice = listing.base_price_thb > 0
    const hasImages = listing.images && listing.images.length > 0
    return hasPrice && hasImages
  }

  /**
   * Get validation error message for draft
   */
  function getDraftValidationError(listing) {
    const errors = []
    if (!listing.base_price_thb || listing.base_price_thb <= 0) {
      errors.push('Укажите цену')
    }
    if (!listing.images || listing.images.length === 0) {
      errors.push('Добавьте фото')
    }
    return errors.join(', ')
  }

  /**
   * Publish draft listing - Send to Admin moderation
   */
  async function publishDraft(listing) {
    if (!canPublishDraft(listing)) {
      toast({
        title: 'Невозможно опубликовать',
        description: getDraftValidationError(listing),
        variant: 'destructive'
      })
      return
    }

    setPublishingId(listing.id)

    try {
      // 1. Update listing: status = PENDING, remove is_draft flag
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

      if (!updateRes.ok) {
        throw new Error('Failed to update listing')
      }

      // 2. Send notification to Admin Group (Thread 17 - NEW_PARTNERS for moderation)
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

      // 3. Update local state
      setListings(prev => prev.map(l => 
        l.id === listing.id 
          ? { ...l, status: 'PENDING', metadata: { ...l.metadata, is_draft: false } }
          : l
      ))

      // 4. Show success toast
      toast({
        title: 'Отправлено на модерацию',
        description: 'Администратор проверит ваш листинг в ближайшее время',
      })

    } catch (error) {
      console.error('Failed to publish draft:', error)
      toast({
        title: 'Ошибка публикации',
        description: 'Попробуйте ещё раз',
        variant: 'destructive'
      })
    } finally {
      setPublishingId(null)
    }
  }

  async function deleteListing(id) {
    try {
      // Find listing to get images for cleanup
      const listingToDelete = listings.find(l => l.id === id)
      
      // 1. Clean up storage files first
      if (listingToDelete?.images?.length > 0) {
        const filePaths = listingToDelete.images
          .filter(url => url && url.includes(`/storage/v1/object/public/${STORAGE_BUCKET}/`))
          .map(url => {
            const match = url.match(new RegExp(`/${STORAGE_BUCKET}/(.+)$`))
            return match ? match[1] : null
          })
          .filter(Boolean)
        
        if (filePaths.length > 0) {
          // Delete from storage
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
      
      // 2. Delete listing from database
      await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${id}`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      })
      setListings(listings.filter(l => l.id !== id))
      setDeleteId(null)
      
      toast({
        title: 'Удалено',
        description: 'Листинг успешно удалён',
      })
    } catch (error) {
      console.error('Failed to delete listing:', error)
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить листинг',
        variant: 'destructive'
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    )
  }

  const statusColors = {
    ACTIVE: 'bg-green-100 text-green-700',
    PENDING: 'bg-yellow-100 text-yellow-700',
    DRAFT: 'bg-slate-100 text-slate-600 border border-dashed border-slate-400',
    INACTIVE: 'bg-slate-100 text-slate-700',
    REJECTED: 'bg-red-100 text-red-700',
    BOOKED: 'bg-blue-100 text-blue-700',
  }

  const statusLabels = {
    ACTIVE: 'Активный',
    PENDING: 'На модерации',
    DRAFT: 'Черновик',
    INACTIVE: 'Неактивный',
    REJECTED: 'Отклонён',
    BOOKED: 'Забронирован',
  }
  
  // Helper to get effective status (check metadata.is_draft)
  // If metadata.is_draft = true, show as draft regardless of DB status
  function getEffectiveStatus(listing) {
    if (listing.metadata?.is_draft === true) return 'DRAFT'
    // Return the actual status (should be uppercase from DB)
    return listing.status || 'DRAFT'
  }

  return (
    <div className="p-4 lg:p-8 space-y-6 lg:space-y-8 max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900">Мои листинги</h1>
          <p className="text-sm lg:text-base text-slate-600 mt-1">
            Управляйте своими предложениями
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1 bg-white border rounded-lg p-1">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button asChild className="bg-teal-600 hover:bg-teal-700">
            <Link href="/partner/listings/new">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Добавить</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats - Stack on mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <Card>
          <CardContent className="p-4 lg:pt-6">
            <div className="text-xl lg:text-2xl font-bold text-slate-900">{listings.length}</div>
            <p className="text-xs lg:text-sm text-slate-600">Всего</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 lg:pt-6">
            <div className="text-xl lg:text-2xl font-bold text-green-600">
              {listings.filter(l => l.status === 'ACTIVE').length}
            </div>
            <p className="text-xs lg:text-sm text-slate-600">Активных</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 lg:pt-6">
            <div className="text-xl lg:text-2xl font-bold text-slate-900">
              {listings.reduce((sum, l) => sum + l.views, 0)}
            </div>
            <p className="text-xs lg:text-sm text-slate-600">Просмотров</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 lg:pt-6">
            <div className="text-xl lg:text-2xl font-bold text-slate-900">
              {listings.reduce((sum, l) => sum + (l.bookingsCount || 0), 0)}
            </div>
            <p className="text-xs lg:text-sm text-slate-600">Бронирований</p>
          </CardContent>
        </Card>
      </div>

      {/* Listings Grid/List */}
      {listings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <Plus className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              У вас пока нет листингов
            </h3>
            <p className="text-slate-600 mb-6 text-center max-w-md">
              Начните зарабатывать, добавив своё первое предложение
            </p>
            <Button asChild className="bg-teal-600 hover:bg-teal-700">
              <Link href="/partner/listings/new">
                <Plus className="h-4 w-4 mr-2" />
                Добавить первый листинг
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map((listing) => {
            const effectiveStatus = getEffectiveStatus(listing)
            return (
            <Card key={listing.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="relative h-48">
                <img
                  src={listing.images?.[0] || listing.cover_image || '/placeholder.jpg'}
                  alt={listing.title}
                  className="w-full h-full object-cover"
                />
                <Badge className={`absolute top-3 right-3 ${statusColors[effectiveStatus]}`}>
                  {statusLabels[effectiveStatus]}
                </Badge>
              </div>
              <CardHeader>
                <CardTitle className="line-clamp-1">{listing.title}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {listing.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Цена</span>
                  <span className="font-semibold text-slate-900">
                    {formatPrice(listing.base_price_thb, 'THB')}/день
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Комиссия</span>
                  <span className="text-red-600">{listing.commission_rate}%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-slate-600">
                    <Eye className="h-3 w-3" />
                    {listing.views || 0}
                  </span>
                  <span className="text-slate-600">
                    {listing.bookingsCount || 0} бронирований
                  </span>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                {/* PUBLISH DRAFT BUTTON - Only for drafts */}
                {isDraft(listing) && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="w-full">
                          <Button 
                            onClick={() => publishDraft(listing)}
                            disabled={!canPublishDraft(listing) || publishingId === listing.id}
                            className={`w-full ${canPublishDraft(listing) 
                              ? 'bg-teal-600 hover:bg-teal-700' 
                              : 'bg-slate-300 cursor-not-allowed'}`}
                            size="sm"
                            data-testid={`publish-draft-${listing.id}`}
                          >
                            {publishingId === listing.id ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Публикация...
                              </>
                            ) : !canPublishDraft(listing) ? (
                              <>
                                <AlertCircle className="h-4 w-4 mr-2" />
                                Заполните данные
                              </>
                            ) : (
                              <>
                                <Send className="h-4 w-4 mr-2" />
                                Отправить на модерацию
                              </>
                            )}
                          </Button>
                        </div>
                      </TooltipTrigger>
                      {!canPublishDraft(listing) && (
                        <TooltipContent>
                          <p>{getDraftValidationError(listing)}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                )}
                
                {/* Standard action buttons */}
                <div className="flex gap-2 w-full">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1" 
                    asChild
                    data-testid={`view-listing-${listing.id}`}
                  >
                    <Link href={`/listings/${listing.id}`} target="_blank">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      На сайте
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" asChild>
                    <Link href={`/partner/listings/${listing.id}`}>
                      <Edit className="h-3 w-3 mr-1" />
                      Редактировать
                    </Link>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setDeleteId(listing.id)}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Удалить
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardFooter>
            </Card>
          )})}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {listings.map((listing) => {
                const effectiveStatus = getEffectiveStatus(listing)
                return (
                <div key={listing.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <img
                      src={listing.images?.[0] || listing.cover_image || '/placeholder.jpg'}
                      alt={listing.title}
                      className="w-24 h-24 object-cover rounded-lg"
                    />
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-slate-900">{listing.title}</h3>
                          <p className="text-sm text-slate-600 mt-1">{listing.district}</p>
                        </div>
                        <Badge className={statusColors[effectiveStatus]}>
                          {statusLabels[effectiveStatus]}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-6 mt-3 text-sm">
                        <span className="text-slate-600">
                          {formatPrice(listing.base_price_thb, 'THB')}/день
                        </span>
                        <span className="flex items-center gap-1 text-slate-600">
                          <Eye className="h-3 w-3" />
                          {listing.views || 0}
                        </span>
                        <span className="text-slate-600">
                          {listing.bookingsCount || 0} бронирований
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      {/* PUBLISH DRAFT BUTTON - Only for drafts (List view) */}
                      {isDraft(listing) && (
                        <Button 
                          onClick={() => publishDraft(listing)}
                          disabled={!canPublishDraft(listing) || publishingId === listing.id}
                          className={`${canPublishDraft(listing) 
                            ? 'bg-teal-600 hover:bg-teal-700' 
                            : 'bg-slate-300 cursor-not-allowed'}`}
                          size="sm"
                          data-testid={`publish-draft-list-${listing.id}`}
                        >
                          {publishingId === listing.id ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Публикация...
                            </>
                          ) : !canPublishDraft(listing) ? (
                            <>
                              <AlertCircle className="h-4 w-4 mr-2" />
                              Заполните
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-2" />
                              На модерацию
                            </>
                          )}
                        </Button>
                      )}
                      
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          asChild
                          data-testid={`view-listing-list-${listing.id}`}
                        >
                          <Link href={`/listings/${listing.id}`} target="_blank">
                            <ExternalLink className="h-3 w-3 mr-1" />
                            На сайте
                          </Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/partner/listings/${listing.id}/edit`}>
                            <Edit className="h-3 w-3 mr-1" />
                            Редактировать
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteId(listing.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )})}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить листинг?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Листинг будет удалён безвозвратно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteListing(deleteId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}