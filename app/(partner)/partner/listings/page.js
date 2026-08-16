'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Eye, Edit, Loader2, AlertCircle, ChevronRight, LogIn, Briefcase } from 'lucide-react'
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
import { MOBILE_FLAT_CARD_CLASS } from '@/lib/ui/mobile-flat-canvas'
import { WorkspaceEmptyState } from '@/components/empty-state'
import { PartnerSectionDivider } from '@/components/partner/PartnerSectionDivider'
import {
  PARTNER_HUB_LIST_CARD_SURFACE_CLASS,
  PARTNER_LISTING_CARD_SURFACE_CLASS,
  PARTNER_SECTION_TITLE_CLASS,
} from '@/lib/ui/partner-section-rhythm'
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
import { PartnerListingCardActions } from '@/components/partner/listings/PartnerListingCardActions'
import { PartnerConciergeWelcomeBanner } from '@/components/partner/listings/PartnerConciergeWelcomeBanner'
import { ConciergePartnerChecklist } from '@/components/partner/listings/ConciergePartnerChecklist'
import { WORKSPACE_SCROLL_STICKY_CLASS } from '@/lib/layout/workspace-shell'
import {
  usePartnerListings,
  usePartnerListingPatch,
  usePartnerListingDelete,
  usePartnerListingRestore,
} from '@/lib/hooks/use-partner-listings'
import { resolvePostPublishCalendarOnboardingUrl } from '@/lib/partner/post-publish-redirect.js'
import { evaluateCalendarFreshness } from '@/lib/partner/calendar-freshness.js'
import {
  countConciergeDraftListings,
  isConciergeDraftListing,
  isConciergeImportListing,
} from '@/lib/partner/concierge-listing-ui.js'

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
  const router = useRouter()
  const { language, t } = useI18n()
  const { user, loading: authLoading, isAuthenticated, openLoginModal } = useAuth()
  const partnerId = user?.id
  const [listFilter, setListFilter] = useState(
    /** @type {'all' | 'active' | 'draft' | 'pending' | 'rejected' | 'deleted'} */ ('all')
  )
  const trashMode = listFilter === 'deleted'
  // Stage 200.130: keep active list for stats/banners even in trash (deleted drafts still have is_draft).
  const listQueryEnabled = !authLoading && isAuthenticated && !!partnerId
  const {
    data: activeListingsData,
    isLoading: activeListingsLoading,
  } = usePartnerListings(partnerId, {
    enabled: listQueryEnabled,
    filter: null,
  })
  const {
    data: deletedListingsData,
    isLoading: deletedListingsLoading,
  } = usePartnerListings(partnerId, {
    enabled: listQueryEnabled && trashMode,
    filter: 'deleted',
  })
  const patchListing = usePartnerListingPatch(partnerId)
  const deleteListingMutation = usePartnerListingDelete(partnerId)
  const restoreListingMutation = usePartnerListingRestore(partnerId)
  const activeListings = activeListingsData?.listings ?? []
  const deletedListings = deletedListingsData?.listings ?? []
  const listings = trashMode ? deletedListings : activeListings
  const loading =
    authLoading ||
    (isAuthenticated && (trashMode ? deletedListingsLoading : activeListingsLoading))
  const [deleteId, setDeleteId] = useState(null)
  const [publishingId, setPublishingId] = useState(null)
  const [visibilityBusyId, setVisibilityBusyId] = useState(null)
  const [undeleteBusyId, setUndeleteBusyId] = useState(null)
  const [qualityModalListing, setQualityModalListing] = useState(null)
  const [showConciergeWelcome, setShowConciergeWelcome] = useState(false)
  const filterTabRefs = useRef(/** @type {Record<string, HTMLButtonElement | null>} */ ({}))

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const params = new URLSearchParams(window.location.search)
      const filterQ = params.get('filter')
      if (filterQ === 'draft') setListFilter('draft')
      if (params.get('concierge_welcome') === 'true') {
        setShowConciergeWelcome(true)
        setListFilter('draft')
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    const el = filterTabRefs.current[listFilter]
    if (!el || typeof el.scrollIntoView !== 'function') return
    el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [listFilter])

  function dismissConciergeWelcome() {
    setShowConciergeWelcome(false)
    if (typeof window === 'undefined') return
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('concierge_welcome')
      const qs = url.searchParams.toString()
      window.history.replaceState({}, '', qs ? `${url.pathname}?${qs}` : url.pathname)
    } catch {
      /* ignore */
    }
    fetch('/api/v2/partner/concierge-welcome/ack', {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {})
  }

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
            ...(isConciergeImportListing(listing) ? { concierge_stage: 'submitted' } : {}),
          },
        },
        optimisticPatch: (row) => ({
          status: 'PENDING',
          metadata: {
            ...(row.metadata || {}),
            is_draft: false,
            needs_review: true,
            submitted_at: new Date().toISOString(),
            ...(isConciergeImportListing(listing) ? { concierge_stage: 'submitted' } : {}),
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
      router.push(resolvePostPublishCalendarOnboardingUrl(listing.id))
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
    DRAFT: t('partnerListings_statusDraft'),
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
    if (md.is_draft === true || md.is_draft === 'true') return 'DRAFT'
    if (listing.status === 'INACTIVE' && isPartnerHiddenMetadata(md)) return 'HIDDEN'
    return listing.status || 'INACTIVE'
  }

  function isTelegramDraft(listing) {
    return listing.metadata?.source === 'TELEGRAM_LAZY_REALTOR'
  }

  /** Должен вызываться до любых return — иначе ломается порядок хуков */
  const filteredListings = useMemo(() => {
    if (listFilter === 'deleted') return listings
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

  async function undeleteListing(listing) {
    if (!listing?.id) return
    setUndeleteBusyId(listing.id)
    try {
      await restoreListingMutation.mutateAsync({ listingId: listing.id })
      toast({ title: t('partnerListings_toastUndeleteOkTitle') })
      setListFilter('all')
    } catch (e) {
      console.error(e)
      toast({
        title: t('partnerListings_toastUndeleteErrTitle'),
        description: e.message || undefined,
        variant: 'destructive',
      })
    } finally {
      setUndeleteBusyId(null)
    }
  }

  // Live (non-trash) counts for header / draft banners — Stage 200.130; grid KPI removed 201.63
  const stats = {
    total: activeListings.length,
    drafts: activeListings.filter(
      (l) => l.metadata?.is_draft === true || l.metadata?.is_draft === 'true',
    ).length,
    conciergeDrafts: countConciergeDraftListings(activeListings),
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
    <div className='max-w-full space-y-0 overflow-x-hidden'>
      {/* Header - Mobile optimized */}
      <div className={`px-4 py-4 ${WORKSPACE_SCROLL_STICKY_CLASS} z-30 mb-1`}>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-lg font-bold text-slate-900'>{t('partnerListings_title')}</h1>
            <p className='text-xs text-slate-500'>
              {t('partnerListings_count').replace(
                '{count}',
                String(trashMode ? listings.length : stats.total),
              )}
            </p>
          </div>
          <Button
            asChild
            size='sm'
            variant='brand'
            className='min-h-[44px]'
            data-testid='add-listing-btn'
          >
            <Link href='/partner/listings/new'>
              <Plus className='h-4 w-4 mr-1' />
              {t('partnerListings_add')}
            </Link>
          </Button>
        </div>
      </div>

      <section data-partner-section='listings-filters' className='space-y-3 px-4 pt-2'>
        <h2 className={PARTNER_SECTION_TITLE_CLASS}>{t('partnerListings_sectionFilters')}</h2>
        <div
          className='-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-thin'
          data-testid='partner-listings-filter-tabs'
        >
          {[
            { id: 'all', label: t('partnerListings_filterAll') },
            { id: 'active', label: t('partnerListings_filterActive') },
            { id: 'draft', label: t('partnerListings_filterDraft') },
            { id: 'pending', label: t('partnerListings_filterPending') },
            { id: 'rejected', label: t('partnerListings_filterRejected') },
            { id: 'deleted', label: t('partnerListings_filterDeleted') },
          ].map((tab) => (
            <button
              key={tab.id}
              type='button'
              ref={(node) => {
                filterTabRefs.current[tab.id] = node
              }}
              data-testid={`partner-listings-filter-${tab.id}`}
              data-active={listFilter === tab.id ? 'true' : 'false'}
              onClick={() => setListFilter(tab.id)}
              className={cn(
                'inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-xs font-medium border transition-colors',
                listFilter === tab.id
                  ? 'bg-brand text-white border-brand'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-brand/40'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <p className='text-xs leading-relaxed text-slate-500'>
          {t('partnerListings_telegramHint')}
        </p>

        {showConciergeWelcome ? (
          <PartnerConciergeWelcomeBanner
            count={stats.conciergeDrafts}
            t={t}
            onDismiss={dismissConciergeWelcome}
            onReviewDrafts={() => {
              setListFilter('draft')
              dismissConciergeWelcome()
            }}
          />
        ) : null}

        {!showConciergeWelcome && listFilter === 'draft' && stats.conciergeDrafts > 0 ? (
          <div
            className="rounded-2xl border border-brand/20 bg-brand/5 px-3 py-3 max-sm:rounded-none max-sm:border-x-0"
            data-testid="concierge-drafts-checklist-strip"
          >
            <p className="text-sm font-semibold text-slate-900">
              {t('partnerListings_conciergeWelcomeTitle')}
            </p>
            <ConciergePartnerChecklist t={t} />
          </div>
        ) : null}

        {stats.drafts > 0 &&
        listFilter !== 'draft' &&
        listFilter !== 'deleted' &&
        !showConciergeWelcome ? (
          <div className="flex flex-col gap-2 rounded-2xl border border-brand/20 bg-brand/5 px-3 py-3 max-sm:rounded-none max-sm:border-0 max-sm:bg-transparent max-sm:px-0 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-800">
              {t('partnerListings_resumeDraftsBanner').replace('{count}', String(stats.drafts))}
            </p>
            <Button
              type="button"
              variant="brand"
              className="min-h-[44px] w-full shrink-0 sm:w-auto"
              onClick={() => setListFilter('draft')}
              data-testid="resume-drafts-banner-btn"
            >
              {t('partnerListings_resumeDraftsCta')}
            </Button>
          </div>
        ) : null}
      </section>

      <PartnerSectionDivider />

      <section data-partner-section='listings-list' className='space-y-3 px-4 pb-4 max-sm:px-0'>
        <h2 className={cn(PARTNER_SECTION_TITLE_CLASS, 'max-sm:px-4')}>
          {t('partnerListings_sectionList')}
        </h2>
        {listings.length === 0 ? (
          <WorkspaceEmptyState
            icon={Briefcase}
            title={t('partnerListings_emptyTitle')}
            hint={t('partnerListings_emptyBody')}
            ctaLabel={t('partnerListings_emptyCta')}
            ctaHref="/partner/listings/new"
            className={PARTNER_HUB_LIST_CARD_SURFACE_CLASS}
            testId="partner-listings-empty"
          />
        ) : filteredListings.length === 0 ? (
          <WorkspaceEmptyState
            icon={Briefcase}
            title={t('partnerListings_emptyFilter')}
            hint={t('partnerListings_emptyFilterHint')}
            className={PARTNER_HUB_LIST_CARD_SURFACE_CLASS}
            testId="partner-listings-empty-filter"
          />
        ) : (
          filteredListings.map((listing) => {
            const status = getStatus(listing)
            const statusLabel = statusLabels[status] || statusLabels.INACTIVE
            const isDraftListing = status === 'DRAFT'
            const isConcierge = isConciergeImportListing(listing)
            const isConciergeDraft = isConciergeDraftListing(listing)
            const showPublishCta =
              !trashMode &&
              !isDraftListing &&
              (status === 'INACTIVE' || status === 'REJECTED') &&
              !isPartnerHiddenMetadata(listing.metadata)
            const publishChecklist = getPublishChecklist(listing)
            const ready = publishChecklist.ok
            const canHideFromSite =
              !trashMode &&
              listing.status === 'ACTIVE' &&
              listing.metadata?.is_draft !== true
            const canRestoreToSite =
              !trashMode &&
              isPartnerHiddenMetadata(listing.metadata) &&
              listing.status === 'INACTIVE' &&
              listing.metadata?.is_draft !== true
            const calendarFreshness = evaluateCalendarFreshness(listing)
            
            return (
              <Card 
                key={listing.id} 
                className={cn(
                  MOBILE_FLAT_CARD_CLASS,
                  PARTNER_LISTING_CARD_SURFACE_CLASS,
                  'overflow-hidden active:bg-slate-50 transition-colors',
                )}
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
                              basePriceAsset={listing.basePriceAsset || null}
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
                      
                      <div className='mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-slate-500'>
                        <span className='inline-flex items-center gap-1.5'>
                          <Eye className='h-3.5 w-3.5 shrink-0' />
                          {listing.views || 0}
                        </span>
                        <PartnerListingStatusBadge
                          tone={partnerListingStatusToTone(status)}
                          className="h-5 px-2 py-0 text-[10px]"
                        >
                          {statusLabel}
                        </PartnerListingStatusBadge>
                        {isTelegramDraft(listing) && (
                          <Badge variant='outline' className='h-5 border-blue-200 bg-blue-50 px-2 py-0 text-[10px] text-blue-700'>
                            Telegram
                          </Badge>
                        )}
                        {isConcierge ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 h-5 border-brand/30 bg-brand/10 text-brand"
                            data-testid={`concierge-badge-${listing.id}`}
                          >
                            {t('partnerListings_conciergeBadge')}
                          </Badge>
                        ) : null}
                        {(listing.metadata?.quality_incomplete === true ||
                          listing.metadata?.quality_incomplete === 'true' ||
                          listing.metadata?.soft_publish === true ||
                          listing.metadata?.soft_publish === 'true') &&
                        status === 'PENDING' ? (
                          <span data-testid={`listing-incomplete-badge-${listing.id}`}>
                            <PartnerListingStatusBadge
                              tone="draft"
                              className="text-[10px] px-1.5 py-0 h-5"
                            >
                              {t('partnerListings_qualityIncomplete')}
                            </PartnerListingStatusBadge>
                          </span>
                        ) : null}
                      </div>
                      {calendarFreshness.stale ? (
                        <p
                          className="mt-1.5 text-[11px] leading-snug text-amber-800"
                          data-testid={`listing-calendar-freshness-${listing.id}`}
                        >
                          {t(
                            'partnerListings_calendarFreshnessNudge',
                            'Check that prices and dates are still up to date',
                          )}
                        </p>
                      ) : null}
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

                {/* Action buttons — Calendar/Prices + Publish/Hide + More sheet (Stage 194.0-A) */}
                <PartnerListingCardActions
                  listing={listing}
                  t={t}
                  showPublishCta={showPublishCta}
                  showContinueDraft={isDraftListing && !isConciergeDraft}
                  showConciergeReviewCta={isConciergeDraft}
                  ready={ready}
                  publishingId={publishingId}
                  visibilityBusyId={visibilityBusyId}
                  canHideFromSite={canHideFromSite}
                  canRestoreToSite={canRestoreToSite}
                  showUndeleteCta={trashMode}
                  undeleteBusyId={undeleteBusyId}
                  onPublish={publishListing}
                  onOpenQualityModal={setQualityModalListing}
                  onHide={(item) => setListingOnSite(item, false)}
                  onRestore={(item) => setListingOnSite(item, true)}
                  onUndelete={undeleteListing}
                  onDelete={setDeleteId}
                />
              </Card>
            )
          })
        )}
      </section>

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
