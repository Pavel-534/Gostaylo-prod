'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Eye, Edit, Trash2, Send, Loader2, AlertCircle, ExternalLink, ChevronRight, LogIn, Calendar } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/auth-context'
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
import { cn } from '@/lib/utils'
import { ProxiedImage } from '@/components/proxied-image'

/**
 * Partner Listings Page (v2 API)
 * 
 * STERILIZED: All data flows through API v2
 * Uses TanStack Query for reactive state management
 * 
 * @updated 2026-03-13 - Phase 1 Sterilization
 */

export default function PartnerListings() {
  const { toast } = useToast()
  const { user, loading: authLoading, isAuthenticated, openLoginModal } = useAuth()
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState(null)
  const [publishingId, setPublishingId] = useState(null)
  const [listFilter, setListFilter] = useState(
    /** @type {'all' | 'active' | 'draft' | 'pending' | 'rejected'} */ ('all')
  )
  const [visibilityBusyId, setVisibilityBusyId] = useState(null)

  useEffect(() => {
    // Wait for auth to load before fetching listings
    if (!authLoading) {
      if (isAuthenticated && user?.id) {
        loadListings(user.id)
      } else {
        setLoading(false)
      }
    }
  }, [authLoading, isAuthenticated, user?.id])

  async function loadListings(userId) {
    try {
      console.log('[LISTINGS] Loading listings for user:', userId)
      
      // Use API route that has server-side access
      const res = await fetch(`/api/v2/partner/listings?partnerId=${userId}`, {
        credentials: 'include'
      })
      
      const result = await res.json()
      console.log('[LISTINGS] API response:', result)
      
      if (result.success && result.data) {
        // Transform API response to match expected format
        const transformedListings = result.data.map(l => ({
          id: l.id,
          title: l.title,
          status: l.status,
          district: l.district,
          base_price_thb: l.basePriceThb,
          commission_rate: l.commissionRate,
          images: l.images || [],
          cover_image: l.coverImage,
          available: l.available,
          is_featured: l.isFeatured,
          views: l.views || 0,
          bookings_count: l.bookingsCount || 0,
          rating: l.rating || 0,
          category: l.category,
          created_at: l.createdAt,
          updated_at: l.updatedAt,
          metadata: l.metadata || {}
        }))
        setListings(transformedListings)
        console.log('[LISTINGS] Loaded:', transformedListings.length, 'listings')
      } else {
        console.error('[LISTINGS] API error:', result.error)
        setListings([])
      }
      
      setLoading(false)
    } catch (error) {
      console.error('Failed to load listings:', error)
      setLoading(false)
    }
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
      // Update via server API
      const updateRes = await fetch(`/api/v2/partner/listings/${listing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status: 'PENDING',
          metadata: {
            ...(listing.metadata || {}),
            is_draft: false,
            needs_review: true,
            submitted_at: new Date().toISOString(),
          },
        })
      })

      const result = await updateRes.json()
      if (!result.success) throw new Error(result.error || 'Failed to update listing')

      // Send Telegram notification (optional - don't block on failure)
      try {
        await fetch('/api/v2/admin/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            action: 'send_moderation_notification',
            listing: {
              id: listing.id,
              title: listing.title,
              base_price_thb: listing.base_price_thb,
              images_count: listing.images?.length || 0,
              district: listing.district
            }
          })
        })
      } catch (e) {
        console.log('Telegram notification failed (non-blocking):', e.message)
      }

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
      // Use server API for deletion (handles storage cleanup too)
      const res = await fetch(`/api/v2/partner/listings/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      
      const result = await res.json()
      
      if (result.success) {
        setListings((prev) => prev.filter((l) => l.id !== id))
        setDeleteId(null)
        toast({ title: 'Удалено', description: 'Листинг успешно удалён' })
      } else {
        throw new Error(result.error || 'Failed to delete')
      }
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
    HIDDEN: { label: 'Скрыт', color: 'bg-slate-200 text-slate-800 border-slate-300' },
    REJECTED: { label: 'Отклонён', color: 'bg-red-100 text-red-700 border-red-200' },
    BOOKED: { label: 'Забронирован', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  }

  // Get effective status (handle metadata.is_draft, partner_hidden)
  function getStatus(listing) {
    const md = listing.metadata || {}
    if (md.is_draft === true || md.is_draft === 'true') return 'INACTIVE'
    if (listing.status === 'INACTIVE' && md.partner_hidden) return 'HIDDEN'
    return listing.status || 'INACTIVE'
  }

  function isTelegramDraft(listing) {
    return listing.metadata?.source === 'TELEGRAM_LAZY_REALTOR'
  }

  /** Должен вызываться до любых return — иначе ломается порядок хуков */
  const filteredListings = useMemo(() => {
    return listings.filter((l) => {
      const md = l.metadata || {}
      if (listFilter === 'all') return true
      if (listFilter === 'active') return l.status === 'ACTIVE'
      if (listFilter === 'draft') return md.is_draft === true || md.is_draft === 'true'
      if (listFilter === 'pending') return l.status === 'PENDING'
      if (listFilter === 'rejected') return l.status === 'REJECTED'
      return true
    })
  }, [listings, listFilter])

  // Stats calculation (API: bookingsCount → bookings_count)
  const stats = {
    total: listings.length,
    active: listings.filter(l => l.status === 'ACTIVE').length,
    views: listings.reduce((sum, l) => sum + (l.views || 0), 0),
    bookings: listings.reduce((sum, l) => sum + (l.bookings_count || 0), 0),
  }

  async function setListingOnSite(listing, onSite) {
    setVisibilityBusyId(listing.id)
    try {
      const md = listing.metadata || {}
      const res = await fetch(`/api/v2/partner/listings/${listing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(
          onSite
            ? {
                status: 'ACTIVE',
                metadata: {
                  ...md,
                  partner_hidden: false,
                  paused_at: null,
                },
              }
            : {
                status: 'INACTIVE',
                metadata: {
                  ...md,
                  partner_hidden: true,
                  paused_at: new Date().toISOString(),
                },
              }
        ),
      })
      const result = await res.json()
      if (!result.success) throw new Error(result.error || 'Ошибка')

      setListings((prev) =>
        prev.map((l) =>
          l.id === listing.id
            ? {
                ...l,
                status: onSite ? 'ACTIVE' : 'INACTIVE',
                metadata: {
                  ...md,
                  partner_hidden: !onSite,
                  ...(onSite ? { paused_at: null } : { paused_at: new Date().toISOString() }),
                },
              }
            : l
        )
      )
      toast({
        title: onSite ? 'Снова на сайте' : 'Снято с публикации',
        description: onSite
          ? 'Объект снова виден гостям'
          : 'Объект скрыт с витрины, данные сохранены',
      })
    } catch (e) {
      console.error(e)
      toast({
        title: 'Ошибка',
        description: e.message || 'Не удалось обновить',
        variant: 'destructive',
      })
    } finally {
      setVisibilityBusyId(null)
    }
  }

  if (loading || authLoading) {
    return (
      <div className='flex items-center justify-center min-h-[60vh]'>
        <Loader2 className='h-8 w-8 animate-spin text-teal-600' />
      </div>
    )
  }

  // Not authenticated - show login prompt
  if (!isAuthenticated) {
    return (
      <div className='flex flex-col items-center justify-center min-h-[60vh] px-4'>
        <div className='w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4'>
          <LogIn className='h-8 w-8 text-slate-400' />
        </div>
        <h2 className='text-xl font-semibold text-slate-900 mb-2'>Войдите в систему</h2>
        <p className='text-slate-500 text-center mb-6'>
          Для просмотра ваших листингов необходимо авторизоваться
        </p>
        <Button
          onClick={() => openLoginModal('login')}
          className='bg-teal-600 hover:bg-teal-700'
          data-testid='login-prompt-btn'
        >
          <LogIn className='h-4 w-4 mr-2' />
          Войти
        </Button>
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

      {/* Filters — как вкладки Airbnb: быстрый доступ к черновикам и модерации */}
      <div className='px-4 pt-2 pb-1'>
        <div className='flex gap-1.5 overflow-x-auto pb-2 scrollbar-thin -mx-1 px-1'>
          {[
            { id: 'all', label: 'Все' },
            { id: 'active', label: 'На сайте' },
            { id: 'draft', label: 'Черновики' },
            { id: 'pending', label: 'Модерация' },
            { id: 'rejected', label: 'Отклонены' },
          ].map((tab) => (
            <button
              key={tab.id}
              type='button'
              onClick={() => setListFilter(tab.id)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors',
                listFilter === tab.id
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <p className='text-[11px] text-slate-500 pb-2'>
          Черновики из Telegram-бота «ленивый риелтор» попадают сюда с пометкой — доработайте и отправьте на модерацию.
        </p>
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
        ) : filteredListings.length === 0 ? (
          <Card className='border-dashed'>
            <CardContent className='py-8 text-center text-sm text-slate-500'>
              В этой категории пока нет объектов.
            </CardContent>
          </Card>
        ) : (
          filteredListings.map((listing) => {
            const status = getStatus(listing)
            const config = statusConfig[status] || statusConfig.INACTIVE
            const showPublishCta = status === 'INACTIVE' || status === 'REJECTED'
            const ready = isReadyToPublish(listing)
            const canHideFromSite =
              listing.status === 'ACTIVE' && listing.metadata?.is_draft !== true
            const canRestoreToSite =
              listing.metadata?.partner_hidden === true &&
              listing.status === 'INACTIVE' &&
              listing.metadata?.is_draft !== true
            
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
                    <div className='relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden'>
                      <ProxiedImage
                        src={listing.images?.[0] || listing.cover_image || '/placeholder.svg'}
                        alt={listing.title}
                        fill
                        className='object-cover'
                        sizes='80px'
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
                        {isTelegramDraft(listing) && (
                          <Badge variant='outline' className='text-[10px] px-1.5 py-0 h-5 border-blue-200 text-blue-700 bg-blue-50'>
                            Telegram
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
                
                {/* Action buttons — редактирование, календарь/iCal, видимость на сайте */}
                <div className='px-3 pb-3 flex flex-wrap gap-2'>
                  {/* Публикация / повторная отправка после отклонения */}
                  {showPublishCta && (
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
                  
                  {/* Edit */}
                  <Button
                    variant='outline'
                    size='sm'
                    className='h-9'
                    asChild
                  >
                    <Link href={`/partner/listings/${listing.id}`} title='Редактировать'>
                      <Edit className='h-4 w-4 sm:mr-1' />
                      <span className='hidden sm:inline text-xs'>Изменить</span>
                    </Link>
                  </Button>

                  {/* Календарь + iCal — якорь на странице редактирования */}
                  <Button variant='outline' size='sm' className='h-9' asChild>
                    <Link
                      href={`/partner/listings/${listing.id}#partner-calendar-sync`}
                      title='Календарь и синхронизация iCal'
                    >
                      <Calendar className='h-4 w-4 sm:mr-1' />
                      <span className='hidden sm:inline text-xs'>Календарь</span>
                    </Link>
                  </Button>

                  {canHideFromSite && (
                    <Button
                      variant='outline'
                      size='sm'
                      className='h-9 text-slate-700'
                      disabled={visibilityBusyId === listing.id}
                      onClick={(e) => {
                        e.preventDefault()
                        setListingOnSite(listing, false)
                      }}
                    >
                      {visibilityBusyId === listing.id ? (
                        <Loader2 className='h-4 w-4 animate-spin' />
                      ) : (
                        <span className='text-xs'>Скрыть</span>
                      )}
                    </Button>
                  )}

                  {canRestoreToSite && (
                    <Button
                      size='sm'
                      className='h-9 bg-teal-600 hover:bg-teal-700 text-xs'
                      disabled={visibilityBusyId === listing.id}
                      onClick={(e) => {
                        e.preventDefault()
                        setListingOnSite(listing, true)
                      }}
                    >
                      {visibilityBusyId === listing.id ? (
                        <Loader2 className='h-4 w-4 animate-spin' />
                      ) : (
                        'На сайт'
                      )}
                    </Button>
                  )}
                  
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
