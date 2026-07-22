'use client'

/**
 * BookingWidget - Sticky Desktop + Fixed Mobile Booking Interface
 * Category-aware: exclusive (property/vehicles) vs shared (tours/yachts/services).
 */

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Star, ArrowRight, MessageCircle, Loader2, Sparkles } from 'lucide-react'
import {
  formatDisplayPriceInCurrency,
  displayPriceRawForTest,
} from '@/lib/pricing/fx-display-client'
import { getUIText } from '@/lib/translations'
import { parseDurationDiscountTiers } from '@/lib/listing/duration-discount-tiers.js'
import { getListingRentalPeriodMode } from '@/lib/listing-booking-ui'
import { formatRentalSpanLabel } from '@/lib/rental-period-labels'
import { cn } from '@/lib/utils'
import { useMemo } from 'react'
import { getPdpHeroGuestPriceThb, scrollToBookingPriceBreakdown } from '@/lib/pricing/guest-display-price'
import { PDP_BOOKING_DATES_ANCHOR_ATTR } from '@/lib/listing/pdp-hero-layout'
import { useBookingWidgetLogic } from '@/hooks/pricing/useBookingWidgetLogic'
import { BookingPriceBreakdown } from '@/components/listing/booking/BookingPriceBreakdown'
import { BookingDateGuestsPicker } from '@/components/listing/booking/BookingDateGuestsPicker'
import {
  BookingActionButtons,
  resolveListingInstantBooking,
} from '@/components/listing/booking/BookingActionButtons'

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

export const PriceBreakdownBlock = BookingPriceBreakdown

function useHeroGuestPrice(listing, priceCalc) {
  return useMemo(() => getPdpHeroGuestPriceThb({ listing, priceCalc }), [listing, priceCalc])
}

function HeroPriceHeadline({
  listing,
  priceCalc,
  currency,
  exchangeRates,
  language,
  rentalPeriodMode,
  tx,
  sizeClass = 'text-3xl',
  compact = false,
}) {
  const hero = useHeroGuestPrice(listing, priceCalc)
  const spanMode = rentalPeriodMode === 'day' ? 'day' : 'night'
  const periodWord =
    rentalPeriodMode === 'day'
      ? getUIText('listingPriceUnitDay', language)
      : getUIText('night', language)

  let secondaryLine =
    hero.mode === 'stay' && hero.nights > 0
      ? formatRentalSpanLabel(hero.nights, spanMode, language)
      : tx(rentalPeriodMode === 'day' ? 'perBookingDay' : 'perNight')

  if (hero.mode === 'stay' && hero.nights > 0 && hero.unitThb > 0) {
    const unitFmt = formatDisplayPriceInCurrency(hero.unitThb, currency, exchangeRates, language)
    secondaryLine = getUIText('listingHero_priceComposition', language)
      .replace(/\{\{unit\}\}/g, unitFmt)
      .replace(/\{\{nights\}\}/g, String(hero.nights))
      .replace(/\{\{period\}\}/g, periodWord)
  }

  return (
    <div>
      <div
        className={cn('font-bold text-slate-900 tabular-nums leading-tight', sizeClass)}
        data-testid="listing-hero-price"
        data-test-hero-mode={hero.mode}
        data-test-hero-nights={String(hero.nights || 0)}
        data-test-hero-payable="1"
        data-test-raw-value={displayPriceRawForTest(hero.amountThb, currency, exchangeRates)}
      >
        {formatDisplayPriceInCurrency(hero.amountThb, currency, exchangeRates, language)}
      </div>
      <p
        className={cn('text-slate-500 leading-snug', compact ? 'text-[11px] sm:text-xs' : 'text-sm')}
        data-testid="booking-per-period-label"
      >
        {secondaryLine}
      </p>
      {!compact ? (
        <button
          type="button"
          className="mt-1 max-w-full text-left text-xs leading-snug text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-700 hover:decoration-slate-400 sm:text-[13px] py-0.5 -ml-0.5 pl-0.5 pr-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80"
          onClick={scrollToBookingPriceBreakdown}
        >
          {getUIText('listingHero_priceFeesNote', language)}
        </button>
      ) : (
        <button
          type="button"
          className="mt-0.5 inline-flex min-h-11 max-w-full items-center text-left text-[11px] leading-snug text-slate-500 underline decoration-slate-300 underline-offset-2"
          onClick={scrollToBookingPriceBreakdown}
          data-testid="listing-mobile-fee-link"
        >
          {getUIText('listingHero_priceFeesNote', language)}
        </button>
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
  const {
    rentalPeriodMode,
    maxGuests,
    maxCap,
    remaining,
    sharedMode,
    wholeVessel,
    tx,
    askPartnerLabel,
  } = useBookingWidgetLogic({
    listing,
    language,
    bookingUiMode,
    availabilitySnapshot,
    hasExistingConversation,
    askPartnerLoading,
  })

  const headlineRating =
    Number(listing.rating ?? listing.avgRating ?? listing.average_rating ?? 0) || 0

  return (
    <div className="hidden lg:block sticky top-24">
      <Card className="border-slate-200 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <HeroPriceHeadline
              listing={listing}
              priceCalc={priceCalc}
              currency={currency}
              exchangeRates={exchangeRates}
              language={language}
              rentalPeriodMode={rentalPeriodMode}
              tx={tx}
            />
            {headlineRating > 0 && (
              <div className="flex items-center gap-1 text-sm">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="font-semibold">{headlineRating.toFixed(1)}</span>
                {(listing.reviewsCount || listing.reviews_count || 0) > 0 && (
                  <span className="text-slate-500">({listing.reviewsCount || listing.reviews_count})</span>
                )}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {wholeVessel && dateRange?.from && dateRange?.to && (
            <div className="rounded-lg border border-brand/20 bg-brand/10 px-3 py-2 text-sm text-brand">
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
            <div className="rounded-lg border border-brand/20 bg-brand/10 px-3 py-2 text-sm text-brand">
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
                {tx(
                  rentalPeriodMode === 'day' ? 'durationDiscountTeaserActiveDay' : 'durationDiscountTeaserActiveNight',
                ).replace(/\{\{pct\}\}/g, String(durationDiscountPercentActive))}
              </p>
            </div>
          )}

          <div {...{ [PDP_BOOKING_DATES_ANCHOR_ATTR]: '' }} className="scroll-mt-24">
            <BookingDateGuestsPicker
            listing={listing}
            language={language}
            rentalPeriodMode={rentalPeriodMode}
            tx={tx}
            calendarKey={calendarKey}
            dateRange={dateRange}
            setDateRange={setDateRange}
            guests={guests}
            setGuests={setGuests}
            maxGuests={maxGuests}
            vehicleStartTime={vehicleStartTime}
            vehicleEndTime={vehicleEndTime}
            onVehicleStartTimeChange={onVehicleStartTimeChange}
            onVehicleEndTimeChange={onVehicleEndTimeChange}
          />
          </div>

          <BookingPriceBreakdown
            priceCalc={priceCalc}
            currency={currency}
            exchangeRates={exchangeRates}
            language={language}
            rentalPeriodMode={rentalPeriodMode}
          />

          <BookingActionButtons
            language={language}
            tx={tx}
            askPartnerLabel={askPartnerLabel}
            dateRange={dateRange}
            onBookingClick={onBookingClick}
            showAskPartner={showAskPartner}
            onAskPartner={onAskPartner}
            onAskPartnerUnavailable={onAskPartnerUnavailable}
            askPartnerLoading={askPartnerLoading}
            hasExistingConversation={hasExistingConversation}
            lastMessagePreview={lastMessagePreview}
            hasUnreadFromHost={hasUnreadFromHost}
            bookingUiMode={bookingUiMode}
            availabilityLoading={availabilityLoading}
            canInstantBook={canInstantBook}
            isInstantBookListing={resolveListingInstantBooking(listing)}
            exclusiveDatesUnavailable={exclusiveDatesUnavailable}
            onPrivateTripClick={onPrivateTripClick}
            onSpecialPriceClick={onSpecialPriceClick}
          />
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
  const { tx, askPartnerLabel, sharedMode } = useBookingWidgetLogic({
    listing,
    language,
    bookingUiMode,
    hasExistingConversation,
    askPartnerLoading,
  })
  const mobileOfferTiers = parseDurationDiscountTiers(listing?.metadata?.discounts)
  const isInstantBookListing = resolveListingInstantBooking(listing)
  const payHintTitle = isInstantBookListing
    ? tx('listingBookingPayHintInstant')
    : tx('listingBookingPayHintInquiry')
  const onChatClick = exclusiveDatesUnavailable ? onAskPartnerUnavailable || onAskPartner : onAskPartner
  const showChatButton = exclusiveDatesUnavailable
    ? !!(onAskPartnerUnavailable || onAskPartner)
    : !!(showAskPartner && onAskPartner)

  return (
    <div
      className="lg:hidden fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white px-3 py-2.5 shadow-2xl left-[max(0px,env(safe-area-inset-left))] right-[max(0px,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]"
    >
      {mobileOfferTiers.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-800/90">
            {tx('specialOffersTitle')}
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
              {tx('listingDetail_spotsLoading')}
            </span>
          )}
          {!availabilityLoading && onPrivateTripClick && (
            <button
              type="button"
              className="text-brand-hover font-medium underline-offset-2 hover:underline"
              onClick={onPrivateTripClick}
            >
              {tx('listingDetail_privateTrip')}
            </button>
          )}
          {!availabilityLoading && onSpecialPriceClick && (
            <button
              type="button"
              className="text-slate-600 underline-offset-2 hover:underline"
              onClick={onSpecialPriceClick}
            >
              {tx('listingDetail_specialPrice')}
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <HeroPriceHeadline
            listing={listing}
            priceCalc={priceCalc}
            currency={currency}
            exchangeRates={exchangeRates}
            language={language}
            rentalPeriodMode={rentalPeriodMode}
            tx={tx}
            sizeClass="text-lg sm:text-xl"
            compact
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {showChatButton && (
            <div className="relative">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={onChatClick}
                disabled={askPartnerLoading}
                data-testid="booking-contact-host"
                className={cn(
                  'h-12 w-12 min-h-11 min-w-11 shrink-0 rounded-xl border-brand/25 text-brand-hover hover:bg-brand/10',
                  hasUnreadFromHost && 'border-amber-300 bg-amber-50 text-amber-900',
                )}
                aria-label={askPartnerLabel}
                title={lastMessagePreview ? `${askPartnerLabel}: ${lastMessagePreview}` : askPartnerLabel}
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
            disabled={
              exclusiveDatesUnavailable ||
              (!!dateRange?.from && !!dateRange?.to && availabilityLoading)
            }
            variant="brand"
            data-testid="listing-book-now"
            title={payHintTitle}
            className="h-12 min-h-11 min-w-[7rem] shrink-0 rounded-xl px-4 text-sm font-semibold sm:min-w-[7.5rem] sm:text-base"
          >
            {exclusiveDatesUnavailable
              ? tx('listingDetail_unavailable')
              : tx('bookNow')}
          </Button>
        </div>
      </div>
    </div>
  )
}
