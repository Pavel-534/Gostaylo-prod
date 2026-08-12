/**
 * Stage 194.0-A — listing card primary actions + overflow sheet.
 * Primary: Calendar · Prices | Publish / Hide / Restore
 * Overflow: View, Edit, Photos, Pricing, Delete
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Calendar,
  DollarSign,
  Edit,
  Eye,
  ImageIcon,
  Loader2,
  MoreHorizontal,
  Send,
  AlertCircle,
  Trash2,
  RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

export function PartnerListingCardActions({
  listing,
  t,
  showPublishCta,
  showContinueDraft = false,
  showConciergeReviewCta = false,
  ready,
  publishingId,
  visibilityBusyId,
  canHideFromSite,
  canRestoreToSite,
  showUndeleteCta = false,
  undeleteBusyId = null,
  onPublish,
  onOpenQualityModal,
  onHide,
  onRestore,
  onUndelete,
  onDelete,
}) {
  const [moreOpen, setMoreOpen] = useState(false)
  const isPublishing = publishingId === listing.id
  const isVisibilityBusy = visibilityBusyId === listing.id
  const isUndeleteBusy = undeleteBusyId === listing.id

  const primaryVisibility = showUndeleteCta ? (
    <Button
      variant="brand"
      className="min-h-11 flex-1 text-sm"
      disabled={isUndeleteBusy}
      onClick={(e) => {
        e.preventDefault()
        onUndelete?.(listing)
      }}
      data-testid={`undelete-btn-${listing.id}`}
    >
      {isUndeleteBusy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <RotateCcw className="mr-1 h-4 w-4" />
          <span className="truncate">{t('partnerListings_undelete')}</span>
        </>
      )}
    </Button>
  ) : showConciergeReviewCta ? (
    <Button variant="brand" className="min-h-11 min-h-[44px] flex-1 text-sm" asChild>
      <Link
        href={`/partner/listings/${listing.id}`}
        data-testid={`concierge-review-btn-${listing.id}`}
      >
        <Send className="mr-1 h-4 w-4" />
        <span className="truncate">{t('partnerListings_conciergeReviewCta')}</span>
      </Link>
    </Button>
  ) : showContinueDraft ? (
    <Button variant="brand" className="min-h-11 min-h-[44px] flex-1 text-sm" asChild>
      <Link
        href={`/partner/listings/${listing.id}`}
        data-testid={`continue-draft-btn-${listing.id}`}
      >
        <Edit className="mr-1 h-4 w-4" />
        <span className="truncate">{t('partnerListings_continueDraft')}</span>
      </Link>
    </Button>
  ) : showPublishCta ? (
    <Button
      onClick={(e) => {
        e.preventDefault()
        if (!ready) {
          onOpenQualityModal?.(listing)
          return
        }
        onPublish?.(listing)
      }}
      disabled={isPublishing}
      variant={ready ? 'brand' : 'outline'}
      className={`min-h-11 flex-1 text-sm ${
        ready ? '' : 'border border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200'
      }`}
      data-testid={`publish-btn-${listing.id}`}
    >
      {isPublishing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : !ready ? (
        <>
          <AlertCircle className="mr-1 h-4 w-4" />
          <span className="truncate">{t('partnerListings_finishChecklist')}</span>
        </>
      ) : (
        <>
          <Send className="mr-1 h-4 w-4" />
          {t('partnerListings_publish')}
        </>
      )}
    </Button>
  ) : canHideFromSite ? (
    <Button
      variant="outline"
      className="min-h-11 flex-1 text-slate-700"
      disabled={isVisibilityBusy}
      onClick={(e) => {
        e.preventDefault()
        onHide?.(listing)
      }}
      data-testid={`hide-btn-${listing.id}`}
    >
      {isVisibilityBusy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <span className="text-sm">{t('partnerListings_hide')}</span>
      )}
    </Button>
  ) : canRestoreToSite ? (
    <Button
      variant="brand"
      className="min-h-11 flex-1 text-sm"
      disabled={isVisibilityBusy}
      onClick={(e) => {
        e.preventDefault()
        onRestore?.(listing)
      }}
      data-testid={`restore-btn-${listing.id}`}
    >
      {isVisibilityBusy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        t('partnerListings_restore')
      )}
    </Button>
  ) : null

  return (
    <>
      <div className="flex flex-wrap gap-2 px-3 pb-3">
        <Button variant="outline" className="min-h-11 flex-1" asChild>
          <Link
            href={`/partner/calendar?listingId=${listing.id}`}
            title={t('partnerListings_calendarPrices')}
            data-testid={`calendar-btn-${listing.id}`}
          >
            <Calendar className="mr-1.5 h-4 w-4 shrink-0" />
            <span className="truncate text-sm">{t('partnerListings_calendarPrices')}</span>
          </Link>
        </Button>

        {primaryVisibility}

        <Button
          type="button"
          variant="outline"
          className="min-h-11 min-w-11 shrink-0 px-0"
          aria-label={t('partnerListings_moreActions')}
          data-testid={`listing-more-btn-${listing.id}`}
          onClick={(e) => {
            e.preventDefault()
            setMoreOpen(true)
          }}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          data-testid="partner-listing-more-sheet"
          className={
            'rounded-t-2xl border-t border-slate-200 px-4 pt-3 ' +
            '!bottom-[var(--app-bottom-nav-height,0px)] ' +
            'max-h-[calc(90dvh-var(--app-bottom-nav-height,0px))] ' +
            'pb-[max(1rem,env(safe-area-inset-bottom))]'
          }
        >
          <SheetHeader className="mb-2 text-left">
            <SheetTitle className="truncate text-base">
              {listing.title || t('partnerListings_cardNoTitle')}
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-1.5 pb-2">
            <Button variant="outline" className="min-h-11 w-full justify-start" asChild>
              {/* Stage 200.96 — same-tab so PWA stays in-app (no target=_blank). */}
              <Link href={`/listings/${listing.id}`} onClick={() => setMoreOpen(false)}>
                <Eye className="mr-2 h-4 w-4" />
                {t('partnerListings_viewOnSite')}
              </Link>
            </Button>
            <Button variant="outline" className="min-h-11 w-full justify-start" asChild>
              <Link href={`/partner/listings/${listing.id}`} onClick={() => setMoreOpen(false)}>
                <Edit className="mr-2 h-4 w-4" />
                {showConciergeReviewCta
                  ? t('partnerListings_conciergeReviewCta')
                  : showContinueDraft
                    ? t('partnerListings_continueDraft')
                    : t('partnerListings_edit')}
              </Link>
            </Button>
            {showContinueDraft || showConciergeReviewCta ? (
              <Button
                variant="outline"
                className="min-h-11 w-full justify-start"
                disabled={isPublishing}
                onClick={() => {
                  setMoreOpen(false)
                  if (!ready) {
                    onOpenQualityModal?.(listing)
                    return
                  }
                  onPublish?.(listing)
                }}
              >
                {isPublishing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                {ready ? t('partnerListings_publish') : t('partnerListings_finishChecklist')}
              </Button>
            ) : null}
            <Button variant="outline" className="min-h-11 w-full justify-start" asChild>
              <Link
                href={`/partner/listings/${listing.id}?step=pricing`}
                onClick={() => setMoreOpen(false)}
              >
                <DollarSign className="mr-2 h-4 w-4" />
                {t('partnerListings_editPricing')}
              </Link>
            </Button>
            <Button variant="outline" className="min-h-11 w-full justify-start" asChild>
              <Link
                href={`/partner/listings/${listing.id}?step=photos`}
                onClick={() => setMoreOpen(false)}
              >
                <ImageIcon className="mr-2 h-4 w-4" />
                {t('partnerListings_editPhotos')}
              </Link>
            </Button>
            {showUndeleteCta ? null : (
              <Button
                variant="outline"
                className="min-h-11 w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700"
                data-testid={`delete-btn-${listing.id}`}
                onClick={() => {
                  setMoreOpen(false)
                  onDelete?.(listing.id)
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t('partnerListings_delete')}
              </Button>
            )}
            {showUndeleteCta ? (
              <Button
                variant="brand"
                className="min-h-11 w-full justify-start"
                disabled={isUndeleteBusy}
                data-testid={`undelete-sheet-btn-${listing.id}`}
                onClick={() => {
                  setMoreOpen(false)
                  onUndelete?.(listing)
                }}
              >
                {isUndeleteBusy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="mr-2 h-4 w-4" />
                )}
                {t('partnerListings_undelete')}
              </Button>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
