'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Eye, Edit, Trash2, Send, Loader2, AlertCircle, ExternalLink, ChevronRight, LogIn, Calendar } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/auth-context'
import { useI18n } from '@/contexts/i18n-context'
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
import {
  buildListingPublishQualityChecklist,
  listingQualityInputFromPartnerListing,
} from '@/lib/partner/listing-quality-gates'
import { PartnerListingPublishQualityModal } from '@/components/partner/PartnerListingPublishQualityModal'
import {
  PartnerListingStatusBadge,
  partnerListingStatusToTone,
} from '@/components/partner/PartnerListingStatusBadge'
import { PartnerListingBasePriceDisplay } from '@/components/partner/listings/partner-listing-base-price-display'
import { WORKSPACE_SCROLL_STICKY_CLASS } from '@/lib/layout/workspace-shell'
import {
  usePartnerListings,
  usePartnerListingPatch,
  usePartnerListingDelete,
} from '@/lib/hooks/use-partner-listings'

function isPartnerHiddenMetadata(metadata) {
  const v = metadata?.partner_hidden
  return v === true || v === 'true'
}

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
  const { language, t } = useI18n()
  const { user, loading: authLoading, isAuthenticated, openLoginModal } = useAuth()
  const partnerId = user?.id
  const {
    data: listingsData,
    isLoading: listingsLoading,
  } = usePartnerListings(partnerId, {
    enabled: !authLoading && isAuthenticated && !!partnerId,
  })
  const patchListing = usePartnerListingPatch(partnerId)
  const deleteListingMutation = usePartnerListingDelete(partnerId)
  const listings = listingsData?.listings ?? []
  const loading = authLoading || (isAuthenticated && listingsLoading)
  const [deleteId, setDeleteId] = useState(null)
  const [publishingId, setPublishingId] = useState(null)
  const [listFilter, setListFilter] = useState(
    /** @type {'all' | 'active' | 'draft' | 'pending' | 'rejected'} */ ('all')
  )
  const [visibilityBusyId, setVisibilityBusyId] = useState(null)
  const [qualityModalListing, setQualityModalListing] = useState(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const q = new URLSearchParams(window.location.search).get('filter')
        if (q === 'draft') setListFilter('draft')
      } catch {
        /* ignore */
      }
    }
  }, [])

  function getPublishChecklist(listing) {
    return buildListingPublishQualityChecklist(listingQualityInputFromPartnerListing(listing))
  }

  // Publish listing to moderation (SSOT quality gates — same as wizard)
  async function publishListing(listing) {
    const checklist = getPublishChecklist(listing)
    if (!checklist.ok) {
      setQualityModalListing(listing)
      return
    }

    setPublishingId(listing.id)

    try {
      await patchListing.mutateAsync({
        listingId: listing.id,
        body: {
          status: 'PENDING',
          metadata: {
            ...(listing.metadata || {}),
            is_draft: false,
            needs_review: true,
            submitted_at: new Date().toISOString(),
          },
        },
        optimisticPatch: (row) => ({
          status: 'PENDING',
          metadata: {
            ...(row.metadata || {}),
            is_draft: false,
            needs_review: true,
            submitted_at: new Date().toISOString(),
          },
        }),
      })

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

      toast({
        title: t('partnerListings_toastPublishOkTitle'),
        description: t('partnerListings_toastPublishOkBody'),
      })
    } catch (error) {
      console.error('Failed to publish:', error)
      if (error.code === 'LISTING_QUALITY_GATE' || error.errors?.length) {
        setQualityModalListing(listing)
      }
      toast({
        title: t('partnerListings_toastPublishErrTitle'),
        description: error.message || t('partnerListings_toastPublishErrBody'),
        variant: 'destructive'
      })
    } finally {
      setPublishingId(null)
    }
  }

  // Delete listing with storage cleanup
  async function deleteListing(id) {
    try {
      await deleteListingMutation.mutateAsync({ listingId: id })
      setDeleteId(null)
      toast({ title: t('partnerListings_toastDeletedTitle') })
    } catch (error) {
      console.error('Failed to delete:', error)
      toast({ title: t('partnerListings_toastDeleteErrTitle'), variant: 'destructive' })
    }
  }

  const statusLabels = {
    ACTIVE: t('partnerListings_statusActive'),
    PENDING: t('partnerListings_statusPending'),
    INACTIVE: t('partnerListings_statusDraft'),
    HIDDEN: t('partnerListings_statusHidden'),
    REJECTED: t('partnerListings_statusRejected'),
    BOOKED: t('partnerListings_statusBooked'),
  }

  const localeTag = { ru: 'ru-RU', en: 'en-US', zh: 'zh-CN', th: 'th-TH' }[language] || 'ru-RU'
  function formatRejectedAt(value) {
    if (!value) return ''
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleDateString(localeTag, { day: 'numeric', month: 'short', year: 'numeric' })
  }

  // Get effective status (handle metadata.is_draft, partner_hidden)
  function getStatus(listing) {
    const md = listing.metadata || {}
    if (md.is_draft === true || md.is_draft === 'true') return 'INACTIVE'
    if (listing.status === 'INACTIVE' && isPartnerHiddenMetadata(md)) return 'HIDDEN'
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
      const body = onSite
        ? {
            status: 'ACTIVE',
            available: true,
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

      await patchListing.mutateAsync({
        listingId: listing.id,
        body,
        optimisticPatch: (row) => ({
          status: onSite ? 'ACTIVE' : 'INACTIVE',
          available: onSite ? true : row.available,
          metadata: {
            ...(row.metadata || {}),
            partner_hidden: !onSite,
            paused_at: onSite ? null : new Date().toISOString(),
          },
        }),
      })
      toast({
        title: onSite
          ? t('partnerListings_toastRestoreOkTitle')
          : t('partnerListings_toastHideOkTitle'),
      })
    } catch (e) {
      console.error(e)
      if (e.code === 'LISTING_QUALITY_GATE' || e.errors?.length) {
        setQualityModalListing(listing)
      }
      toast({
        title: t('partnerListings_toastUpdateErrTitle'),
        description: e.message || undefined,
        variant: 'destructive',
      })
    } finally {
      setVisibilityBusyId(null)
    }
  }

  if (loading || authLoading) {
    return (
      <div className='flex items-center justify-center min-h-[60vh]'>
        <Loader2 className='h-8 w-8 animate-spin text-brand' />
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
        <h2 className='text-xl font-semibold text-slate-900 mb-2'>{t('partnerListings_loginTitle')}</h2>
        <p className='text-slate-500 text-center mb-6'>
          {t('partnerListings_loginBody')}
        </p>
        <Button
          onClick={() => openLoginModal('login')}
          variant='brand'
          data-testid='login-prompt-btn'
        >
          <LogIn className='h-4 w-4 mr-2' />
          {t('partnerListings_loginBtn')}
        </Button>
      </div>
    )
  }

  return (
    <div className='max-w-full overflow-x-hidden'>
      {/* Header - Mobile optimized */}
      <div className={`px-4 py-4 ${WORKSPACE_SCROLL_STICKY_CLASS} z-30`}>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-lg font-bold text-slate-900'>{t('partnerListings_title')}</h1>
            <p className='text-xs text-slate-500'>{t('partnerListings_count').replace('{count}', stats.total)}</p>
          </div>
          <Button 
            asChild 
            size='sm'
            variant='brand'
            data-testid='add-listing-btn'
          >
            <Link href='/partner/listings/new'>
              <Plus className='h-4 w-4 mr-1' />
              {t('partnerListings_add')}
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters — как вкладки Airbnb: быстрый доступ к черновикам и модерации */}
      <div className='px-4 pt-2 pb-1'>
        <div className='flex gap-1.5 overflow-x-auto pb-2 scrollbar-thin -mx-1 px-1'>
          {[
            { id: 'all', label: t('partnerListings_filterAll') },
            { id: 'active', label: t('partnerListings_filterActive') },
            { id: 'draft', label: t('partnerListings_filterDraft') },
            { id: 'pending', label: t('partnerListings_filterPending') },
            { id: 'rejected', label: t('partnerListings_filterRejected') },
          ].map((tab) => (
            <button
              key={tab.id}
              type='button'
              onClick={() => setListFilter(tab.id)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors',
                listFilter === tab.id
                  ? 'bg-brand text-white border-brand'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-brand/40'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <p className='text-[11px] text-slate-500 pb-2'>
          {t('partnerListings_telegramHint')}
        </p>
      </div>

      {/* Stats - 2x2 grid on mobile */}
      <div className='grid grid-cols-2 gap-2 p-4'>
        <div className='bg-white rounded-lg p-3 border'>
          <div className='text-xl font-bold text-slate-900'>{stats.total}</div>
          <div className='text-xs text-slate-500'>{t('partnerListings_statTotal')}</div>
        </div>
        <div className='bg-white rounded-lg p-3 border'>
          <div className='text-xl font-bold text-brand'>{stats.active}</div>
          <div className='text-xs text-slate-500'>{t('partnerListings_statActive')}</div>
        </div>
        <div className='bg-white rounded-lg p-3 border'>
          <div className='text-xl font-bold text-slate-900'>{stats.views}</div>
          <div className='text-xs text-slate-500'>{t('partnerListings_statViews')}</div>
        </div>
        <div className='bg-white rounded-lg p-3 border'>
          <div className='text-xl font-bold text-slate-900'>{stats.bookings}</div>
          <div className='text-xs text-slate-500'>{t('partnerListings_statBookings')}</div>
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
                {t('partnerListings_emptyTitle')}
              </h3>
              <p className='text-sm text-slate-500 mb-4 text-center'>
                {t('partnerListings_emptyBody')}
              </p>
              <Button asChild variant='brand'>
                <Link href='/partner/listings/new'>
                  <Plus className='h-4 w-4 mr-2' />
                  {t('partnerListings_emptyCta')}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : filteredListings.length === 0 ? (
          <Card className='border-dashed'>
            <CardContent className='py-8 text-center text-sm text-slate-500'>
              {t('partnerListings_emptyFilter')}
            </CardContent>
          </Card>
        ) : (
          filteredListings.map((listing) => {
            const status = getStatus(listing)
            const statusLabel = statusLabels[status] || statusLabels.INACTIVE
            const showPublishCta = status === 'INACTIVE' || status === 'REJECTED'
            const publishChecklist = getPublishChecklist(listing)
            const ready = publishChecklist.ok
            const canHideFromSite =
              listing.status === 'ACTIVE' && listing.metadata?.is_draft !== true
            const canRestoreToSite =
              isPartnerHiddenMetadata(listing.metadata) &&
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
                          {listing.title || t('partnerListings_cardNoTitle')}
                        </h3>
                        <ChevronRight className='h-4 w-4 text-slate-400 flex-shrink-0' />
                      </div>
                      
                      <p className='text-xs text-slate-500 mt-0.5'>
                        {listing.district || t('partnerListings_cardDistrictUnknown')}
                      </p>
                      
                      <div className='flex items-center gap-2 mt-1.5'>
                        <span className='tabular-nums'>
                          {listing.base_price_thb > 0 ? (
                            <PartnerListingBasePriceDisplay
                              amount={listing.base_price_thb}
                              baseCurrency={listing.base_currency || listing.baseCurrency || 'THB'}
                              className="items-start"
                            />
                          ) : (
                            <span className='font-semibold text-sm text-slate-900'>
                              {t('partnerListings_cardPriceUnset')}
                            </span>
                          )}
                        </span>
                        <span className='text-xs text-slate-400'>{t('partnerListings_perDay')}</span>
                      </div>
                      
                      <div className='flex items-center gap-3 mt-1.5 text-xs text-slate-500'>
                        <span className='flex items-center gap-1'>
                          <Eye className='h-3 w-3' />
                          {listing.views || 0}
                        </span>
                        <PartnerListingStatusBadge
                          tone={partnerListingStatusToTone(status)}
                          className="text-[10px] px-1.5 py-0 h-5"
                        >
                          {statusLabel}
                        </PartnerListingStatusBadge>
                        {isTelegramDraft(listing) && (
                          <Badge variant='outline' className='text-[10px] px-1.5 py-0 h-5 border-blue-200 text-blue-700 bg-blue-50'>
                            Telegram
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>

                {/* Причина отказа модерации — дружелюбный блок с путём к исправлению */}
                {status === 'REJECTED' && (
                  <div className='mx-3 mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3'>
                    <div className='flex items-start gap-2'>
                      <AlertCircle className='h-4 w-4 text-rose-500 mt-0.5 flex-shrink-0' />
                      <div className='min-w-0'>
                        <p className='text-xs font-semibold text-rose-900'>
                          {t('partnerListings_rejectedTitle')}
                        </p>
                        <p className='text-xs text-rose-700 mt-0.5 leading-relaxed'>
                          {listing.rejection_reason?.trim()
                            ? listing.rejection_reason
                            : t('partnerListings_rejectedFallback')}
                        </p>
                        {listing.rejected_at ? (
                          <p className='text-[11px] text-rose-500/90 mt-1'>
                            {t('partnerListings_rejectedAt').replace('{date}', formatRejectedAt(listing.rejected_at))}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <Button
                      asChild
                      size='sm'
                      variant='brand'
                      className='mt-2.5 min-h-[44px] h-11 w-full text-xs'
                    >
                      <Link href={`/partner/listings/${listing.id}`}>
                        <Edit className='h-3.5 w-3.5 mr-1.5' />
                        {t('partnerListings_rejectedEditCta')}
                      </Link>
                    </Button>
                  </div>
                )}

                {/* Action buttons — редактирование, календарь/iCal, видимость на сайте */}
                <div className='px-3 pb-3 flex flex-wrap gap-2'>
                  {/* Публикация / повторная отправка после отклонения */}
                  {showPublishCta && (
                    <Button
                      onClick={(e) => {
                        e.preventDefault()
                        if (!ready) {
                          setQualityModalListing(listing)
                          return
                        }
                        publishListing(listing)
                      }}
                      disabled={publishingId === listing.id}
                      variant={ready ? 'brand' : 'outline'}
                      className={`flex-1 min-h-[44px] h-11 text-sm ${
                        ready
                          ? ''
                          : 'bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300'
                      }`}
                      data-testid={`publish-btn-${listing.id}`}
                    >
                      {publishingId === listing.id ? (
                        <Loader2 className='h-4 w-4 animate-spin' />
                      ) : !ready ? (
                        <>
                          <AlertCircle className='h-4 w-4 mr-1' />
                          <span className='truncate'>{t('partnerListings_finishChecklist')}</span>
                        </>
                      ) : (
                        <>
                          <Send className='h-4 w-4 mr-1' />
                          {t('partnerListings_publish')}
                        </>
                      )}
                    </Button>
                  )}
                  
                  {/* View on site button */}
                  <Button
                    variant='outline'
                    size='sm'
                    className='min-h-[44px] h-11'
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
                    className='min-h-[44px] h-11'
                    asChild
                  >
                    <Link href={`/partner/listings/${listing.id}`} title={t('partnerListings_edit')}>
                      <Edit className='h-4 w-4 sm:mr-1' />
                      <span className='hidden sm:inline text-xs'>{t('partnerListings_edit')}</span>
                    </Link>
                  </Button>

                  {/* Мастер-календарь, отфильтрованный по этому листингу (не страница редактирования) */}
                  <Button variant='outline' size='sm' className='min-h-[44px] h-11' asChild>
                    <Link
                      href={`/partner/calendar?listingId=${listing.id}`}
                      title={t('partnerListings_calendar')}
                    >
                      <Calendar className='h-4 w-4 sm:mr-1' />
                      <span className='hidden sm:inline text-xs'>{t('partnerListings_calendar')}</span>
                    </Link>
                  </Button>

                  {canHideFromSite && (
                    <Button
                      variant='outline'
                      size='sm'
                      className='min-h-[44px] h-11 text-slate-700'
                      disabled={visibilityBusyId === listing.id}
                      onClick={(e) => {
                        e.preventDefault()
                        setListingOnSite(listing, false)
                      }}
                    >
                      {visibilityBusyId === listing.id ? (
                        <Loader2 className='h-4 w-4 animate-spin' />
                      ) : (
                        <span className='text-xs'>{t('partnerListings_hide')}</span>
                      )}
                    </Button>
                  )}

                  {canRestoreToSite && (
                    <Button
                      size='sm'
                      variant='brand'
                      className='min-h-[44px] h-11 text-xs'
                      disabled={visibilityBusyId === listing.id}
                      onClick={(e) => {
                        e.preventDefault()
                        setListingOnSite(listing, true)
                      }}
                    >
                      {visibilityBusyId === listing.id ? (
                        <Loader2 className='h-4 w-4 animate-spin' />
                      ) : (
                        t('partnerListings_restore')
                      )}
                    </Button>
                  )}
                  
                  {/* Delete button */}
                  <Button
                    variant='outline'
                    size='sm'
                    className='min-h-[44px] h-11 text-red-600 hover:text-red-700 hover:bg-red-50'
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
            <AlertDialogTitle>{t('partnerListings_deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('partnerListings_deleteBody')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className='flex-row gap-2'>
            <AlertDialogCancel className='flex-1 m-0'>{t('partnerListings_cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteListing(deleteId)}
              className='flex-1 m-0 bg-red-600 hover:bg-red-700'
            >
              {t('partnerListings_delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PartnerListingPublishQualityModal
        open={!!qualityModalListing}
        onOpenChange={(open) => {
          if (!open) setQualityModalListing(null)
        }}
        listing={qualityModalListing}
        onRetryPublish={
          qualityModalListing
            ? () => {
                setQualityModalListing(null)
                publishListing(qualityModalListing)
              }
            : undefined
        }
      />
    </div>
  )
}
