'use client'

import { Button } from '@/components/ui/button'
import { getUIText } from '@/lib/translations'
import { ArrowRight, MessageCircle } from 'lucide-react'

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
  exclusiveDatesUnavailable = false,
  onPrivateTripClick,
  onSpecialPriceClick,
}) {
  const canBook = !!dateRange?.from && !!dateRange?.to && canInstantBook && !availabilityLoading
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
        disabled={!canBook}
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

      <p className="text-xs leading-relaxed text-slate-500 text-center px-1">
        {tx('listingBookingPayHint')}
      </p>

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
