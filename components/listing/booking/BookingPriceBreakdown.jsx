'use client'

import { Separator } from '@/components/ui/separator'
import { formatPrice, priceRawForTest } from '@/lib/currency'
import { getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'
import {
  BOOKING_PRICE_BREAKDOWN_ID,
  getGuestPayableTotalThb,
} from '@/lib/pricing/guest-display-price'

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
  if (language === 'ru') return `Скидка за ${min}+ ${unit}`
  if (language === 'zh') return `${min}+${unit}折扣`
  if (language === 'th') return `ส่วนลด ${min}+ ${unit}`
  return `Discount (${min}+ ${unit})`
}

export function BookingPriceBreakdown({
  priceCalc,
  currency,
  exchangeRates,
  language,
  rentalPeriodMode = 'night',
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
      : rentalPeriodMode === 'day'
        ? getUIText('breakdownBaseTimesDays', language)
        : language === 'ru'
          ? 'База × ночей'
          : 'Base rate × nights'

  const taxLabel =
    taxAmount > 0
      ? getUIText('orderPrice_taxVatLine', language).replace(/\{\{rate\}\}/g, String(taxRate))
      : getUIText('breakdownTaxIncluded', language)

  return (
    <div id={BOOKING_PRICE_BREAKDOWN_ID} className="space-y-2 pt-4 border-t text-sm scroll-mt-24">
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
        <span className="text-slate-600">{getUIText('serviceFee', language)}</span>
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
