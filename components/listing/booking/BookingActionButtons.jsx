'use client'

import { Button } from '@/components/ui/button'
import { getUIText } from '@/lib/translations'
import { ArrowRight, Clock, MessageCircle, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

function ChatPreviewBadge({ preview, hasUnread, language }) {
  if (!preview) return null
  const label = preview.length > 55 ? `${preview.slice(0, 55)}…` : preview
  return (
    <div
      className={`flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-xs ${
        hasUnread
          ? 'bg-amber-50 border border-amber-200 text-amber-800'
          : 'bg-slate-50 border border-slate-200 text-slate-500'
      }`}
    >
      {hasUnread && <span className="mt-px h-2 w-2 shrink-0 rounded-full bg-amber-500" />}
      <span className="leading-tight">
        {hasUnread ? (language === 'ru' ? 'Новый ответ: ' : 'New reply: ') : language === 'ru' ? 'Последнее: ' : 'Last: '}
        <span className="font-medium">{label}</span>
      </span>
    </div>
  )
}

/**
 * Stage 190.3 — Instant Book vs request-to-book pay timing (display-only).
 * Do not confuse with availability `canInstantBook` (dates free).
 */
export function BookingPayTimingHint({ isInstantBookListing, tx, className }) {
  const instant = isInstantBookListing === true
  const Icon = instant ? Zap : Clock
  return (
    <p
      className={cn(
        'flex items-start justify-center gap-1.5 text-xs leading-relaxed px-1 text-center',
        instant ? 'text-brand' : 'text-slate-500',
        className,
      )}
      data-testid="listing-booking-pay-hint"
      data-instant-book={instant ? '1' : '0'}
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
      <span>
        {instant ? tx('listingBookingPayHintInstant') : tx('listingBookingPayHintInquiry')}
      </span>
    </p>
  )
}

export function resolveListingInstantBooking(listing) {
  return listing?.instantBooking === true || listing?.instant_booking === true
}

export function BookingActionButtons({
  language,
  tx,
  askPartnerLabel,
  dateRange,
  onBookingClick,
  showAskPartner = false,
  onAskPartner,
  onAskPartnerUnavailable,
  askPartnerLoading = false,
  lastMessagePreview = null,
  hasUnreadFromHost = false,
  bookingUiMode = 'exclusive',
  availabilityLoading = false,
  canInstantBook = true,
  isInstantBookListing = false,
  exclusiveDatesUnavailable = false,
  onPrivateTripClick,
  onSpecialPriceClick,
}) {
  const sharedMode = bookingUiMode === 'shared'

  return (
    <>
      {showAskPartner && onAskPartner && !exclusiveDatesUnavailable && (
        <div className="space-y-1.5">
          <Button
            type="button"
            variant="outline"
            onClick={onAskPartner}
            disabled={askPartnerLoading}
            data-testid="booking-contact-host"
            className={`w-full h-12 text-base border-brand/25 text-brand-hover hover:bg-brand/10 ${
              hasUnreadFromHost ? 'border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900' : ''
            }`}
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            {askPartnerLabel}
          </Button>
          <ChatPreviewBadge
            preview={lastMessagePreview}
            hasUnread={hasUnreadFromHost}
            language={language}
          />
        </div>
      )}

      <Button
        onClick={onBookingClick}
        disabled={
          exclusiveDatesUnavailable ||
          (!!dateRange?.from && !!dateRange?.to && availabilityLoading)
        }
        variant="brand"
        data-testid="listing-book-now"
        className="w-full h-12 text-base"
      >
        {exclusiveDatesUnavailable
          ? language === 'ru'
            ? 'Даты недоступны'
            : 'Dates unavailable'
          : tx('bookNow')}
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>

      <BookingPayTimingHint isInstantBookListing={isInstantBookListing} tx={tx} />

      {sharedMode && (onPrivateTripClick || onSpecialPriceClick) && (
        <div className="grid gap-2">
          {onPrivateTripClick && (
            <Button
              type="button"
              variant="secondary"
              className="w-full h-11 border border-brand/25 bg-white text-brand hover:bg-brand/10"
              onClick={onPrivateTripClick}
              disabled={!dateRange?.from || !dateRange?.to}
            >
              {language === 'ru'
                ? 'Запросить приватный тур / индивидуальную цену'
                : 'Request private trip / individual price'}
            </Button>
          )}
          {onSpecialPriceClick && (
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 border-dashed border-slate-300 text-slate-700"
              onClick={onSpecialPriceClick}
              disabled={!dateRange?.from || !dateRange?.to}
            >
              {language === 'ru' ? 'Запросить особую цену' : 'Request special price'}
            </Button>
          )}
        </div>
      )}

      {exclusiveDatesUnavailable && (onAskPartnerUnavailable || onAskPartner) && (
        <Button
          type="button"
          variant="outline"
          className="w-full h-12 border-brand/30 text-brand hover:bg-brand/10"
          onClick={onAskPartnerUnavailable || onAskPartner}
          disabled={askPartnerLoading}
          data-testid="booking-contact-host-unavailable"
        >
          <MessageCircle className="mr-2 h-4 w-4" />
          {language === 'ru' ? 'Спросить у хозяина в чате' : getUIText('listingDetail_askPartnerChat', language)}
        </Button>
      )}

      {(!dateRange?.from || !dateRange?.to) && (
        <p className="text-xs text-center text-slate-500">{tx('selectDatesToBook')}</p>
      )}
    </>
  )
}
