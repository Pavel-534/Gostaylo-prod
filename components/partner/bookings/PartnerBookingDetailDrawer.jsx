'use client'

import { useEffect, useState } from 'react'
import UnifiedOrderCard from '@/components/orders/UnifiedOrderCard'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { getUIText } from '@/lib/translations'
import { resolvePartnerBookingListingTitle } from '@/lib/partner/partner-booking-card-model'
import { useIsMobile } from '@/hooks/use-mobile'

function useVisualViewportMaxHeight(fallback = '92dvh') {
  const [maxHeight, setMaxHeight] = useState(fallback)

  useEffect(() => {
    const update = () => {
      if (typeof window !== 'undefined' && window.visualViewport) {
        setMaxHeight(`${window.visualViewport.height}px`)
      }
    }
    update()
    window.visualViewport?.addEventListener('resize', update)
    return () => window.visualViewport?.removeEventListener('resize', update)
  }, [])

  return maxHeight
}

/**
 * Full booking detail — bottom sheet (mobile) or right panel (md+).
 * Stage 176.2: visualViewport, sticky partner CTA footer via UnifiedOrderCard layout=drawer.
 */
export function PartnerBookingDetailDrawer({
  booking,
  open,
  onOpenChange,
  language = 'ru',
  isBusy = false,
  isLoading = false,
  onConfirm,
  onDecline,
  onComplete,
}) {
  const isMobile = useIsMobile()
  const side = isMobile ? 'bottom' : 'right'
  const viewportHeight = useVisualViewportMaxHeight()
  const title = booking ? resolvePartnerBookingListingTitle(booking, language) : ''

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        style={side === 'bottom' ? { maxHeight: viewportHeight } : undefined}
        className={
          side === 'bottom'
            ? 'z-[210] flex max-h-[92dvh] flex-col gap-0 overflow-hidden rounded-t-2xl border-slate-200 p-0'
            : 'z-[210] flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg'
        }
      >
        <div className="shrink-0 border-b border-slate-100 bg-background px-4 pb-3 pr-14 pt-5 sm:px-6">
          <SheetHeader className="space-y-0 p-0 text-left">
            <SheetTitle className="text-lg font-semibold text-slate-900 line-clamp-2">{title}</SheetTitle>
            <p className="text-xs text-slate-500 mt-1">{getUIText('partnerBookings_detailSubtitle', language)}</p>
          </SheetHeader>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4">
          {isLoading ? (
            <p className="py-12 text-center text-sm text-slate-500">
              {getUIText('partnerFinances_ledgerBookingLoading', language)}
            </p>
          ) : booking ? (
            <UnifiedOrderCard
              booking={booking}
              unifiedOrder={booking._unified}
              role="partner"
              density="full"
              layout="drawer"
              language={language}
              cardAnchorId={booking.id}
              isBusy={isBusy}
              onConfirm={onConfirm}
              onDecline={onDecline}
              onComplete={onComplete}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
