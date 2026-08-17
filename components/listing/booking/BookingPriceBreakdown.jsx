'use client'

import { Separator } from '@/components/ui/separator'
import { formatPrice, priceRawForTest } from '@/lib/currency'
import { getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'
import {
  BOOKING_PRICE_BREAKDOWN_ID,
  getGuestPayableTotalThb,
} from '@/lib/pricing/guest-display-price'
import {
  buildGuestPriceExclusionHints,
  formatGuestOnSiteFeeAmount,
} from '@/lib/booking/guest-price-exclusions.js'

function durationStayDiscountLabel(priceCalc, language, rentalPeriodMode) {
  const min = priceCalc.durationDiscountMinNights
  const pct = priceCalc.durationDiscountPercent
  if (!min || !pct) {
    return getUIText('listingBooking_durationDiscount', language)
  }
  const unit = getUIText(
    rentalPeriodMode === 'day' ? 'listingBooking_unitDays' : 'listingBooking_unitNights',
    language,
  )
  return getUIText('listingBooking_durationDiscountMin', language)
    .replace(/\{min\}/g, String(min))
    .replace(/\{unit\}/g, unit)
}

export function BookingPriceBreakdown({
  priceCalc,
  currency,
  exchangeRates,
  language,
  rentalPeriodMode = 'night',
  listingCategorySlug = '',
  listingMetadata = null,
}) {
  if (!priceCalc) return null

  const nights = Math.max(0, Math.round(Number(priceCalc.nights) || 0))
  const subtotal = Math.round(
    Number(priceCalc.subtotalBeforeFee ?? priceCalc.totalPrice ?? priceCalc.subtotal) || 0,
  )
  const serviceFee = Math.round(Number(priceCalc.serviceFee) || 0)
  const taxAmount = Math.round(Number(priceCalc.taxAmountThb) || 0)
  const taxRate = Number(priceCalc.taxRatePercent) || 0
  const payableTotal = getGuestPayableTotalThb(priceCalc)
  const roundingPot = Math.max(
    0,
    Math.round(
      Number(
        priceCalc.roundingDiffPot ??
          priceCalc.roundingPotThb ??
          priceCalc.rounding_diff_pot ??
          0,
      ) || 0,
    ),
  )
  const exclusionHints = buildGuestPriceExclusionHints(listingCategorySlug, listingMetadata)

  const baseRaw = priceCalc.baseRawSubtotal
  const seasonalAdj = priceCalc.seasonalAdjustment
  const dur = priceCalc.durationDiscountAmount
  const hasSeasonal = seasonalAdj !== 0 && seasonalAdj != null
  const hasDur = dur > 0
  const seasonalIsDiscount = hasSeasonal && seasonalAdj < 0
  const highlightTotalForDiscount = hasDur || seasonalIsDiscount
  const hasAdjustments = hasSeasonal || hasDur

  const periodWord =
    rentalPeriodMode === 'day'
      ? getUIText('listingPriceUnitDay', language)
      : getUIText('night', language)

  const fmt = (thb) => formatPrice(thb, currency, exchangeRates, language)

  /** `$X × N nights` — list base when known, else average of lodging subtotal. */
  const formulaUnitThb =
    baseRaw != null && nights > 0
      ? Math.round(Number(baseRaw) / nights)
      : nights > 0
        ? Math.round(subtotal / nights)
        : 0
  const baseTimesLabel =
    nights > 0 && formulaUnitThb > 0
      ? getUIText('breakdownBaseTimesNights', language)
          .replace(/\{\{unit\}\}/g, fmt(formulaUnitThb))
          .replace(/\{\{nights\}\}/g, String(nights))
          .replace(/\{\{period\}\}/g, periodWord)
      : getUIText(
          rentalPeriodMode === 'day'
            ? 'listingBooking_baseTimesDaysShort'
            : 'listingBooking_baseTimesNightsShort',
          language,
        )

  const taxLabel =
    taxAmount > 0
      ? getUIText('orderPrice_taxVatLine', language).replace(/\{\{rate\}\}/g, String(taxRate))
      : getUIText('breakdownTaxIncluded', language)

  // Stage 200.12 — renters see fee amount only (no platform % in guest UI).
  const serviceFeeLabel = getUIText('serviceFee', language)

  return (
    <div
      id={BOOKING_PRICE_BREAKDOWN_ID}
      className="space-y-2 pt-4 border-t text-sm scroll-mt-24"
      data-testid="booking-price-breakdown"
    >
      {baseRaw != null ? (
        <div className="flex justify-between gap-2">
          <span className="text-slate-600">{baseTimesLabel}</span>
          <span
            className="font-medium tabular-nums"
            data-test-base-subtotal-value={priceRawForTest(baseRaw, currency, exchangeRates)}
            {...(!hasAdjustments
              ? {
                  'data-test-subtotal-value': priceRawForTest(subtotal, currency, exchangeRates),
                  'data-test-subtotal-thb': String(subtotal),
                }
              : {})}
          >
            {fmt(baseRaw)}
          </span>
        </div>
      ) : null}

      {hasSeasonal && (
        <div className="flex justify-between gap-2">
          <span className={cn(seasonalIsDiscount ? 'font-semibold !text-emerald-600' : 'text-slate-600')}>
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
            {fmt(seasonalAdj)}
          </span>
        </div>
      )}

      {hasDur && (
        <div className="flex justify-between gap-2">
          <span className="font-medium text-emerald-600">
            {durationStayDiscountLabel(priceCalc, language, rentalPeriodMode)}
          </span>
          <span className="font-semibold tabular-nums text-emerald-600">
            −{fmt(dur)}
            {priceCalc.durationDiscountPercent > 0 ? ` (${priceCalc.durationDiscountPercent}%)` : ''}
          </span>
        </div>
      )}

      {/* Lodging subtotal: primary line if no list-base; or after seasonal/duration adjustments. */}
      {(baseRaw == null || hasAdjustments) && (
        <div className="flex justify-between gap-2 pt-1">
          <span className="text-slate-600">
            {baseRaw == null
              ? baseTimesLabel
              : getUIText('subtotal', language)}
          </span>
          <span
            className="font-medium tabular-nums"
            data-test-subtotal-value={priceRawForTest(subtotal, currency, exchangeRates)}
            data-test-subtotal-thb={String(subtotal)}
          >
            {fmt(subtotal)}
          </span>
        </div>
      )}

      <div className="flex justify-between gap-2">
        <span className="text-slate-600">{serviceFeeLabel}</span>
        <span
          className="font-medium tabular-nums"
          data-testid="booking-breakdown-service-fee"
          data-test-fee-value={priceRawForTest(serviceFee, currency, exchangeRates)}
          data-test-fee-thb={String(serviceFee)}
        >
          {fmt(serviceFee)}
        </span>
      </div>

      <div className="flex justify-between gap-2 text-slate-600">
        <span>{taxLabel}</span>
        <span
          className="font-medium tabular-nums"
          data-testid="booking-breakdown-tax"
          data-test-tax-thb={String(taxAmount)}
        >
          {taxAmount > 0 ? fmt(taxAmount) : getUIText('breakdownTaxZero', language)}
        </span>
      </div>

      {roundingPot > 0 ? (
        <div className="flex justify-between gap-2 text-slate-600">
          <span>{getUIText('orderPrice_rounding', language)}</span>
          <span
            className="font-medium tabular-nums"
            data-testid="booking-breakdown-rounding"
            data-test-rounding-thb={String(roundingPot)}
          >
            {fmt(roundingPot)}
          </span>
        </div>
      ) : null}

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
          data-test-raw-value={priceRawForTest(payableTotal, currency, exchangeRates)}
          data-test-total-thb={String(payableTotal)}
        >
          {fmt(payableTotal)}
        </span>
      </div>

      {exclusionHints.length > 0 ? (
        <ul className="mt-2 space-y-1 text-xs text-slate-500" data-testid="booking-price-exclusions">
          {exclusionHints.map((hint) => (
            <li key={hint.key}>
              {getUIText(hint.key, language).replace(
                /\{\{amount\}\}/g,
                hint.amountThb != null ? formatGuestOnSiteFeeAmount(hint.amountThb, language) : '',
              )}
            </li>
          ))}
        </ul>
      ) : null}

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
