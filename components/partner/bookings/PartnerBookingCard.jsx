'use client'

import { Calendar, ChevronRight, Home, MapPin, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProxiedImage } from '@/components/proxied-image'
import { resolveImageThumbDisplayUrl } from '@/lib/image-display-url'
import { getUIText } from '@/lib/translations'
import { OrderCardStatusBadge } from '@/components/orders/card-parts/OrderCardStatusBadge'
import { PartnerHostLedgerAmount } from '@/components/partner/finances/partner-host-amount-display'
import {
  formatPartnerBookingDateRange,
  resolvePartnerBookingDistrict,
  resolvePartnerBookingGuestName,
  resolvePartnerBookingListingImage,
  resolvePartnerBookingListingTitle,
  resolvePartnerOrderFooterAmounts,
} from '@/lib/partner/partner-booking-card-model'
import { cn } from '@/lib/utils'

/**
 * Compact partner booking row — tap opens detail drawer.
 */
export function PartnerBookingCard({
  booking,
  language = 'ru',
  selected = false,
  isBusy = false,
  onOpen,
  onQuickConfirm = null,
}) {
  const title = resolvePartnerBookingListingTitle(booking, language)
  const guestName = resolvePartnerBookingGuestName(booking, language)
  const dates = formatPartnerBookingDateRange(booking, language)
  const district = resolvePartnerBookingDistrict(booking)
  const status = String(booking?.status || '').toUpperCase()
  const imageRaw = resolvePartnerBookingListingImage(booking)
  const image = imageRaw ? resolveImageThumbDisplayUrl(imageRaw) || imageRaw : null
  const partnerEarnings = Number(booking?.partnerEarningsThb ?? booking?.partner_earnings_thb)
  const { netEarnings } = resolvePartnerOrderFooterAmounts(booking, partnerEarnings)
  const showQuickConfirm = status === 'PENDING' && typeof onQuickConfirm === 'function'
  const hasChat = !!booking?.conversationId

  return (
    <div
      data-booking-card={booking?.id}
      data-testid={`booking-card-${booking?.id}`}
      className={cn(
        'rounded-2xl border bg-white transition-shadow',
        selected ? 'border-brand ring-2 ring-brand/25 shadow-md' : 'border-slate-200 shadow-sm hover:shadow-md',
      )}
    >
      <button
        type="button"
        onClick={() => onOpen?.(booking)}
        className="flex w-full items-start gap-3 p-3 text-left min-h-[44px] rounded-2xl transition-colors active:bg-slate-50"
        aria-label={getUIText('partnerBookings_openDetails', language)}
      >
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-100">
          {image ? (
            <ProxiedImage src={image} alt="" fill className="object-cover" sizes="56px" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Home className="h-6 w-6 text-slate-300" aria-hidden />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-slate-900 text-sm leading-snug line-clamp-2">{title}</p>
            <OrderCardStatusBadge status={status} language={language} className="shrink-0 text-[10px]" />
          </div>

          <p className="flex items-center gap-1.5 text-xs text-slate-600">
            <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{dates}</span>
          </p>

          {district ? (
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{district}, Thailand</span>
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-0.5">
            <p className="text-xs text-slate-600 truncate">
              {getUIText('orderCard_guestLabel', language)}:{' '}
              <span className="font-medium text-slate-800">{guestName}</span>
            </p>
            {netEarnings != null ? (
              <p className="text-xs font-semibold text-brand-hover tabular-nums shrink-0">
                <PartnerHostLedgerAmount thb={netEarnings} />
              </p>
            ) : null}
          </div>

          {hasChat ? (
            <p className="inline-flex items-center gap-1 text-[11px] text-slate-500">
              <MessageSquare className="h-3 w-3 shrink-0" aria-hidden />
              {getUIText('orderCard_chatThreadLabel', language)}
            </p>
          ) : null}
        </div>

        <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 mt-1" aria-hidden />
      </button>

      {showQuickConfirm ? (
        <div className="border-t border-slate-100 px-3 py-2">
          <Button
            type="button"
            variant="brand"
            size="sm"
            className="w-full min-h-[44px]"
            disabled={isBusy}
            onClick={(e) => {
              e.stopPropagation()
              onQuickConfirm(booking)
            }}
          >
            {getUIText('orderAction_confirm', language)}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
