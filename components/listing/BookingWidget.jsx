'use client'

/**
 * BookingWidget - Sticky Desktop + Fixed Mobile Booking Interface
 * Category-aware: exclusive (property/vehicles) vs shared (tours/yachts/services).
 */

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { TimeSelect } from '@/components/ui/time-select'
import { Star, ArrowRight, MessageCircle, Loader2, Sparkles } from 'lucide-react'
import { formatPrice, priceRawForTest } from '@/lib/currency'
import { getUIText } from '@/lib/translations'
import { parseDurationDiscountTiers } from '@/lib/services/pricing.service'
import { getListingRentalPeriodMode, isWholeVesselListing } from '@/lib/listing-booking-ui'
import { resolveListingGuestCapacity } from '@/lib/listing-guest-capacity'
import { formatRentalSpanLabel } from '@/lib/rental-period-labels'
import { GostayloCalendar } from '@/components/gostaylo-calendar'
import { GuestCountStepper } from '@/components/listing/GuestCountStepper'
import { cn } from '@/lib/utils'

function ChatPreviewBadge({ preview, hasUnread, language }) {
  if (!preview) return null
  const label = preview.length > 55 ? preview.slice(0, 55) + '…' : preview
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
        {hasUnread
          ? language === 'ru'
            ? 'Новый ответ: '
            : 'New reply: '
          : language === 'ru'
            ? 'Последнее: '
            : 'Last: '}
        <span className="font-medium">{label}</span>
      </span>
    </div>
  )
}

function formatSpecialOfferLine(tier, language, rentalPeriodMode) {
  const pct = Math.round(Number(tier.percent) || 0)
  const n = tier.minNights
  const key = rentalPeriodMode === 'day' ? 'specialOfferDay' : 'specialOfferNight'
  return getUIText(key, language)
    .replace(/\{\{pct\}\}/g, String(pct))
    .replace(/\{\{n\}\}/g, String(n))
}

/** Marketing: show configured duration tiers before guest picks dates (weekly/monthly + legacy keys). */
export function DurationDiscountOffersBlock({ discounts, language, rentalPeriodMode = 'night', className }) {
  const tiers = parseDurationDiscountTiers(discounts)
  if (!tiers.length) return null

  return (
    <div
      className={cn(
        'rounded-xl border border-amber-200/90 bg-gradient-to-br from-amber-50 via-orange-50/80 to-rose-50/60 px-3 py-3 shadow-sm',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
        <span className="text-sm font-semibold tracking-tight text-amber-950">
          {getUIText('specialOffersTitle', language)}
        </span>
      </div>
      <p className="mt-1 text-xs leading-snug text-amber-900/85">
        {getUIText(rentalPeriodMode === 'day' ? 'specialOffersTeaserRental' : 'specialOffersTeaser', language)}
      </p>
      <ul className="mt-2.5 flex flex-col gap-2">
        {tiers.map((t) => (
          <li key={`${t.minNights}-${t.percent}-${t.sourceKey || ''}`}>
            <span
              className="inline-flex w-full items-center justify-center rounded-lg border border-emerald-300/70 bg-white/95 px-3 py-2 text-center text-xs font-bold leading-tight text-emerald-900 shadow-sm sm:text-sm"
              role="status"
            >
              {formatSpecialOfferLine(t, language, rentalPeriodMode)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function durationStayDiscountLabel(priceCalc, language, rentalPeriodMode) {
  const min = priceCalc.durationDiscountMinNights
  const pct = priceCalc.durationDiscountPercent
  if (!min || !pct) {
    return language === 'ru' ? 'Скидка за длительность' : 'Length-of-stay discount'
  }
  const unit =
    rentalPeriodMode === 'day'
      ? language === 'ru'
        ? 'суток'
        : language === 'zh'
          ? '天'
          : language === 'th'
            ? 'วัน'
            : 'days'
      : language === 'ru'
        ? 'ночей'
        : language === 'zh'
          ? '晚'
          : language === 'th'
            ? 'คืน'
            : 'nights'
  if (language === 'ru') {
    return `Скидка за ${min}+ ${unit}`
  }
  if (language === 'zh') {
    return `${min}+${unit}折扣`
  }
  if (language === 'th') {
    return `ส่วนลด ${min}+ ${unit}`
  }
  return `Discount (${min}+ ${unit})`
}

export function PriceBreakdownBlock({ priceCalc, currency, exchangeRates, language, rentalPeriodMode = 'night' }) {
  if (!priceCalc) return null
  const baseRaw = priceCalc.baseRawSubtotal
  const seasonalAdj = priceCalc.seasonalAdjustment
  const dur = priceCalc.durationDiscountAmount
  const hasSeasonal = seasonalAdj !== 0 && seasonalAdj != null
  const hasDur = dur > 0
  const seasonalIsDiscount = hasSeasonal && seasonalAdj < 0
  const highlightTotalForDiscount = hasDur || seasonalIsDiscount
  const baseLineLabel =
    rentalPeriodMode === 'day'
      ? getUIText('breakdownBaseTimesDays', language)
      : language === 'ru'
        ? 'База × ночей'
        : 'Base rate × nights'

  return (
    <div className="space-y-2 pt-4 border-t text-sm">
      {baseRaw != null && (
        <div className="flex justify-between gap-2">
          <span className="text-slate-600">
            {baseLineLabel}
          </span>
          <span
            className="font-medium tabular-nums"
            data-test-base-subtotal-value={priceRawForTest(baseRaw, currency, exchangeRates)}
          >
            {formatPrice(baseRaw, currency, exchangeRates, language)}
          </span>
        </div>
      )}
      {hasSeasonal && (
        <div className="flex justify-between gap-2">
          <span
            className={cn(
              seasonalIsDiscount ? 'font-semibold !text-emerald-600' : 'text-slate-600',
            )}
          >
            {seasonalIsDiscount
              ? getUIText('breakdownSeasonalDiscount', language)
              : getUIText('breakdownSeasonalExtra', language)}
          </span>
          <span
            className={cn(
              'font-semibold tabular-nums',
              seasonalIsDiscount ? '!text-emerald-600' : 'text-amber-800',
            )}
          >
            {seasonalAdj > 0 ? '+' : ''}
            {formatPrice(seasonalAdj, currency, exchangeRates, language)}
          </span>
        </div>
      )}
      {hasDur && (
        <div className="flex justify-between gap-2">
          <span className="font-medium text-emerald-600">
            {durationStayDiscountLabel(priceCalc, language, rentalPeriodMode)}
          </span>
          <span className="font-semibold tabular-nums text-emerald-600">
            −{formatPrice(dur, currency, exchangeRates, language)}
            {priceCalc.durationDiscountPercent > 0
              ? ` (${priceCalc.durationDiscountPercent}%)`
              : ''}
          </span>
        </div>
      )}
      <div className="flex justify-between gap-2 pt-1">
        <span className="text-slate-600">{getUIText('subtotal', language)}</span>
        <span
          className="font-medium tabular-nums"
          data-test-subtotal-value={priceRawForTest(
            priceCalc.subtotalBeforeFee ?? priceCalc.totalPrice,
            currency,
            exchangeRates,
          )}
          data-test-subtotal-thb={String(
            Math.round(Number(priceCalc.subtotalBeforeFee ?? priceCalc.totalPrice) || 0),
          )}
        >
          {formatPrice(priceCalc.subtotalBeforeFee ?? priceCalc.totalPrice, currency, exchangeRates, language)}
        </span>
      </div>
      {Number(priceCalc.taxAmountThb) > 0 ? (
        <div className="flex justify-between gap-2 text-slate-600">
          <span>
            {getUIText('orderPrice_taxVatLine', language).replace(
              /\{\{rate\}\}/g,
              String(Number(priceCalc.taxRatePercent) || 0),
            )}
          </span>
          <span className="font-medium tabular-nums">
            {formatPrice(priceCalc.taxAmountThb, currency, exchangeRates, language)}
          </span>
        </div>
      ) : null}
      {priceCalc.serviceFee > 0 && (
        <div className="flex justify-between gap-2">
          <span className="text-slate-600">{getUIText('serviceFee', language)}</span>
          <span
            className="font-medium tabular-nums"
            data-testid="booking-breakdown-service-fee"
            data-test-fee-value={priceRawForTest(priceCalc.serviceFee, currency, exchangeRates)}
            data-test-fee-thb={String(Math.round(Number(priceCalc.serviceFee) || 0))}
          >
            {formatPrice(priceCalc.serviceFee, currency, exchangeRates, language)}
          </span>
        </div>
      )}
      <Separator />
      <div
        className={cn(
          'flex justify-between items-baseline gap-2 pt-0.5',
          highlightTotalForDiscount &&
            'rounded-lg border border-emerald-200 bg-emerald-50/95 px-2.5 py-2.5 -mx-0.5 shadow-sm',
        )}
      >
        <span
          className={cn(
            'shrink-0',
            highlightTotalForDiscount ? 'text-base font-bold text-emerald-900' : 'text-lg font-bold text-slate-900',
          )}
        >
          {getUIText('total', language)}
        </span>
        <span
          className={cn(
            'tabular-nums font-bold tracking-tight',
            highlightTotalForDiscount ? 'text-xl text-emerald-700 sm:text-2xl' : 'text-lg text-slate-900',
          )}
          data-testid="booking-price-total"
          data-test-raw-value={priceRawForTest(priceCalc.finalTotal, currency, exchangeRates)}
          data-test-total-thb={String(Math.round(Number(priceCalc.finalTotal) || 0))}
        >
          {formatPrice(priceCalc.finalTotal, currency, exchangeRates, language)}
        </span>
      </div>
      {priceCalc.partnerPayoutThb != null && Number.isFinite(Number(priceCalc.partnerPayoutThb)) && (
        <span
          className="sr-only"
          data-test-payout-value={priceRawForTest(priceCalc.partnerPayoutThb, currency, exchangeRates)}
          data-test-payout-thb={String(Math.round(Number(priceCalc.partnerPayoutThb) || 0))}
        >
          {priceRawForTest(priceCalc.partnerPayoutThb, currency, exchangeRates)}
        </span>
      )}
    </div>
  )
}

export function DesktopBookingWidget({
  listing,
  dateRange,
  setDateRange,
  guests,
  setGuests,
  priceCalc,
  currency,
  exchangeRates,
  language,
  calendarKey,
  onBookingClick,
  onAskPartner,
  onAskPartnerUnavailable,
  askPartnerLoading = false,
  showAskPartner = false,
  hasExistingConversation = false,
  lastMessagePreview = null,
  hasUnreadFromHost = false,
  bookingUiMode = 'exclusive',
  vehicleStartTime = '07:00',
  vehicleEndTime = '07:00',
  onVehicleStartTimeChange,
  onVehicleEndTimeChange,
  availabilityLoading = false,
  availabilitySnapshot = null,
  durationDiscountPercentActive = 0,
  showDurationDiscountTeaser = false,
  onPrivateTripClick,
  onSpecialPriceClick,
  canInstantBook = true,
  exclusiveDatesUnavailable = false,
}) {
  const rentalPeriodMode = getListingRentalPeriodMode(listing?.categorySlug || listing?.category?.slug)
  const maxGuests = Math.max(1, resolveListingGuestCapacity(listing))
  const maxCap = listing?.maxCapacity ?? availabilitySnapshot?.max_capacity ?? 1
  const remaining = availabilitySnapshot?.remaining_spots
  const sharedMode = bookingUiMode === 'shared'
  const wholeVessel = isWholeVesselListing(listing?.categorySlug, listing?.metadata)

  return (
    <div className="hidden lg:block sticky top-24">
      <Card className="border-slate-200 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <div>
              <div
                className="text-3xl font-bold text-slate-900"
                data-testid="listing-hero-price"
                data-test-raw-value={priceRawForTest(
                  priceCalc?.avgPricePerNight || listing.basePriceThb,
                  currency,
                  exchangeRates,
                )}
              >
                {formatPrice(priceCalc?.avgPricePerNight || listing.basePriceThb, currency, exchangeRates, language)}
              </div>
              <p
                className="text-sm text-slate-500"
                data-testid="booking-per-period-label"
              >
                {getUIText(rentalPeriodMode === 'day' ? 'perBookingDay' : 'perNight', language)}
              </p>
            </div>
            {(listing.rating > 0 || (listing.reviewsCount || listing.reviews_count || 0) > 0) && (
              <div className="flex items-center gap-1 text-sm">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="font-semibold">{(Number(listing.rating) || 0).toFixed(1)}</span>
                {(listing.reviewsCount || listing.reviews_count || 0) > 0 && (
                  <span className="text-slate-500">({listing.reviewsCount || listing.reviews_count})</span>
                )}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {wholeVessel && dateRange?.from && dateRange?.to && (
            <div className="rounded-lg border border-teal-100 bg-teal-50/80 px-3 py-2 text-sm text-teal-900">
              {availabilityLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {language === 'ru' ? 'Проверяем доступность…' : 'Checking availability…'}
                </span>
              ) : availabilitySnapshot != null ? (
                <span>
                  {availabilitySnapshot.available
                    ? language === 'ru'
                      ? 'Судно свободно на выбранные даты'
                      : 'Vessel available for these dates'
                    : language === 'ru'
                      ? 'Судно недоступно на эти даты'
                      : 'Vessel not available for these dates'}
                </span>
              ) : null}
            </div>
          )}

          {sharedMode && !wholeVessel && dateRange?.from && dateRange?.to && (
            <div className="rounded-lg border border-teal-100 bg-teal-50/80 px-3 py-2 text-sm text-teal-900">
              {availabilityLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {language === 'ru' ? 'Проверяем места…' : 'Checking availability…'}
                </span>
              ) : remaining != null ? (
                <span>
                  {language === 'ru' ? 'Свободных мест' : 'Spots remaining'}:{' '}
                  <strong>{remaining}</strong>
                  {maxCap > 1 ? ` / ${maxCap}` : ''}
                </span>
              ) : null}
            </div>
          )}

          {exclusiveDatesUnavailable && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
              {language === 'ru' ? 'Выбранные даты заняты.' : 'These dates are unavailable.'}
            </div>
          )}

          <DurationDiscountOffersBlock
            discounts={listing?.metadata?.discounts}
            language={language}
            rentalPeriodMode={rentalPeriodMode}
          />

          {showDurationDiscountTeaser && durationDiscountPercentActive > 0 && (
            <div className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-sm text-emerald-900">
              <Sparkles className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                {getUIText(
                  rentalPeriodMode === 'day' ? 'durationDiscountTeaserActiveDay' : 'durationDiscountTeaserActiveNight',
                  language,
                ).replace(/\{\{pct\}\}/g, String(durationDiscountPercentActive))}
              </p>
            </div>
          )}

          <div>
            <Label className="text-sm font-medium mb-2 block">
              {getUIText(rentalPeriodMode === 'day' ? 'travelDatesRental' : 'travelDates', language)}
            </Label>
            <GostayloCalendar
              key={calendarKey}
              listingId={listing.id}
              value={dateRange}
              onChange={setDateRange}
              minStay={listing.minStay}
              language={language}
              guests={guests}
              listingMaxCapacity={listing.maxCapacity}
              rentalPeriodMode={rentalPeriodMode}
            />
          </div>

          {String(listing?.categorySlug || '').toLowerCase() === 'vehicles' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">
                  {language === 'ru' ? 'Время начала' : 'Start time'}
                </Label>
                <TimeSelect
                  value={vehicleStartTime}
                  onChange={onVehicleStartTimeChange}
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">
                  {language === 'ru' ? 'Время окончания' : 'End time'}
                </Label>
                <TimeSelect
                  value={vehicleEndTime}
                  onChange={onVehicleEndTimeChange}
                  className="h-9"
                />
              </div>
            </div>
          )}

          <div>
            <Label className="text-sm font-medium mb-2 block">
              {getUIText(rentalPeriodMode === 'day' ? 'numberOfSeats' : 'numberOfGuests', language)}
            </Label>
            <GuestCountStepper
              value={guests}
              onChange={setGuests}
              min={1}
              max={maxGuests}
            />
          </div>

          <PriceBreakdownBlock
            priceCalc={priceCalc}
            currency={currency}
            exchangeRates={exchangeRates}
            language={language}
            rentalPeriodMode={rentalPeriodMode}
          />

          {showAskPartner && onAskPartner && !exclusiveDatesUnavailable && (
            <div className="space-y-1.5">
              <Button
                type="button"
                variant="outline"
                onClick={onAskPartner}
                disabled={askPartnerLoading}
                data-testid="booking-contact-host"
                className={`w-full h-12 text-base border-teal-200 text-teal-800 hover:bg-teal-50 ${
                  hasUnreadFromHost ? 'border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900' : ''
                }`}
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                {askPartnerLoading
                  ? getUIText('loading', language)
                  : hasExistingConversation
                    ? language === 'ru'
                      ? 'Продолжить диалог'
                      : 'Continue chat'
                    : getUIText('askListingQuestion', language)}
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
            disabled={!dateRange?.from || !dateRange?.to || !canInstantBook || availabilityLoading}
            data-testid="listing-book-now"
            className="w-full h-12 text-base bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700"
          >
            {exclusiveDatesUnavailable
              ? language === 'ru'
                ? 'Даты недоступны'
                : 'Dates unavailable'
              : getUIText('bookNow', language)}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          {sharedMode && (onPrivateTripClick || onSpecialPriceClick) && (
            <div className="grid gap-2">
              {onPrivateTripClick && (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full h-11 border border-teal-200 bg-white text-teal-900 hover:bg-teal-50"
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
              className="w-full h-12 border-teal-300 text-teal-900 hover:bg-teal-50"
              onClick={onAskPartnerUnavailable || onAskPartner}
              disabled={askPartnerLoading}
              data-testid="booking-contact-host-unavailable"
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              {language === 'ru' ? 'Спросить у хозяина в чате' : 'Ask partner in chat'}
            </Button>
          )}

          {(!dateRange?.from || !dateRange?.to) && (
            <p className="text-xs text-center text-slate-500">{getUIText('selectDatesToBook', language)}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function MobileBookingBar({
  priceCalc,
  listing,
  currency,
  exchangeRates,
  language,
  dateRange,
  onBookingClick,
  onAskPartner,
  onAskPartnerUnavailable,
  askPartnerLoading = false,
  showAskPartner = false,
  hasExistingConversation = false,
  lastMessagePreview = null,
  hasUnreadFromHost = false,
  bookingUiMode = 'exclusive',
  availabilityLoading = false,
  canInstantBook = true,
  exclusiveDatesUnavailable = false,
  onPrivateTripClick,
  onSpecialPriceClick,
}) {
  const rentalPeriodMode = getListingRentalPeriodMode(listing?.categorySlug || listing?.category?.slug)
  const askLabel = askPartnerLoading
    ? getUIText('loading', language)
    : hasExistingConversation
      ? language === 'ru'
        ? 'Продолжить диалог'
        : 'Continue chat'
      : getUIText('askListingQuestion', language)

  const sharedMode = bookingUiMode === 'shared'
  const mobileOfferTiers = parseDurationDiscountTiers(listing?.metadata?.discounts)

  return (
    <div
      className="lg:hidden fixed z-50 bg-white border-t border-slate-200 py-3 shadow-2xl left-[max(0px,env(safe-area-inset-left))] right-[max(0px,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))] px-3"
      style={{ bottom: 'calc(4.25rem + env(safe-area-inset-bottom, 0px))' }}
    >
      {mobileOfferTiers.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-800/90">
            {getUIText('specialOffersTitle', language)}
          </span>
          {mobileOfferTiers.map((t) => (
            <span
              key={`mb-${t.minNights}-${t.percent}`}
              className="inline-flex max-w-full rounded-full border border-emerald-400/70 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold leading-tight text-emerald-900"
            >
              {formatSpecialOfferLine(t, language, rentalPeriodMode)}
            </span>
          ))}
        </div>
      )}

      {sharedMode && dateRange?.from && dateRange?.to && (
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
          {availabilityLoading && (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              {language === 'ru' ? 'Места…' : 'Spots…'}
            </span>
          )}
          {!availabilityLoading && onPrivateTripClick && (
            <button
              type="button"
              className="text-teal-700 font-medium underline-offset-2 hover:underline"
              onClick={onPrivateTripClick}
            >
              {language === 'ru' ? 'Приват / цена' : 'Private / quote'}
            </button>
          )}
          {!availabilityLoading && onSpecialPriceClick && (
            <button
              type="button"
              className="text-slate-600 underline-offset-2 hover:underline"
              onClick={onSpecialPriceClick}
            >
              {language === 'ru' ? 'Особая цена' : 'Special price'}
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div
            className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums leading-tight"
            data-testid="listing-hero-price"
            data-test-raw-value={priceRawForTest(
              priceCalc?.avgPricePerNight || listing.basePriceThb,
              currency,
              exchangeRates,
            )}
          >
            {formatPrice(priceCalc?.avgPricePerNight || listing.basePriceThb, currency, exchangeRates, language)}
          </div>
          <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
            {getUIText(rentalPeriodMode === 'day' ? 'perBookingDay' : 'perNight', language)}
            {priceCalc
              ? ` • ${formatRentalSpanLabel(
                  priceCalc.nights,
                  rentalPeriodMode === 'day' ? 'day' : 'night',
                  language,
                )}`
              : ''}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {exclusiveDatesUnavailable && (onAskPartnerUnavailable || onAskPartner) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAskPartnerUnavailable || onAskPartner}
              disabled={askPartnerLoading}
              className="h-12 px-3 border-teal-300 text-teal-900"
            >
              <MessageCircle className="h-5 w-5 sm:mr-1" />
              <span className="hidden sm:inline">
                {language === 'ru' ? 'В чат' : 'Chat'}
              </span>
            </Button>
          )}
          {showAskPartner && onAskPartner && !exclusiveDatesUnavailable && (
            <div className="relative">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={onAskPartner}
                disabled={askPartnerLoading}
                className={`h-12 w-12 shrink-0 border-teal-200 text-teal-800 hover:bg-teal-50 ${
                  hasUnreadFromHost ? 'border-amber-300 bg-amber-50 text-amber-900' : ''
                }`}
                aria-label={askLabel}
                title={lastMessagePreview ? `${askLabel}: ${lastMessagePreview}` : askLabel}
              >
                <MessageCircle className="h-5 w-5" />
              </Button>
              {hasUnreadFromHost && (
                <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-500 ring-1 ring-white" />
              )}
            </div>
          )}
          <Button
            onClick={onBookingClick}
            disabled={!dateRange?.from || !dateRange?.to || !canInstantBook || availabilityLoading}
            data-testid="listing-book-now"
            className="h-12 min-w-[7.5rem] px-4 text-sm sm:text-base bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700"
          >
            {exclusiveDatesUnavailable
              ? language === 'ru'
                ? 'Недоступно'
                : 'Unavailable'
              : getUIText('bookNow', language)}
          </Button>
        </div>
      </div>
    </div>
  )
}
