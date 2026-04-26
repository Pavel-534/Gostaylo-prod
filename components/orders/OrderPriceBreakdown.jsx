'use client'

import { formatPrice } from '@/lib/currency'
import { getUIText } from '@/lib/translations'
import { buildGuestPriceBreakdownFromBooking } from '@/lib/booking/guest-price-breakdown'
import { buildGuestPriceExclusionHints } from '@/lib/booking/guest-price-exclusions'

function n(x) {
  const v = Number(x)
  return Number.isFinite(v) ? v : 0
}

function durationDiscountLabel(b, language) {
  if (b.durationDiscountThb <= 0) return ''
  if (language === 'ru' && b.durationCaptionRu) return b.durationCaptionRu
  if (language !== 'ru' && b.durationCaptionEn) return b.durationCaptionEn
  return b.durationCaptionEn || b.durationCaptionRu || getUIText('orderPrice_durationDiscount', language)
}

function promoDiscountLabel(b, language) {
  if (b.promoDiscountThb <= 0) return ''
  if (b.promoCode) {
    return getUIText('orderPrice_promoDiscountWithCode', language).replace(/\{\{code\}\}/g, b.promoCode)
  }
  return getUIText('orderPrice_promoDiscount', language)
}

function taxVatLineLabel(b, language) {
  if (n(b.taxAmountThb) <= 0) return ''
  const rate = Number(b.taxRatePercent) || 0
  return getUIText('orderPrice_taxVatLine', language).replace(/\{\{rate\}\}/g, String(rate))
}

/**
 * Блок «Детализация цены» для Super-App (гость / партнёр — прозрачность).
 * @param {{ booking?: object | null, breakdown?: object | null, language?: string, role?: 'renter' | 'partner' }} props
 */
export function OrderPriceBreakdown({ booking, breakdown = null, language = 'ru', role = 'renter' }) {
  const b = breakdown && typeof breakdown === 'object' ? breakdown : buildGuestPriceBreakdownFromBooking(booking)
  if (!b.hasDetail) return null

  const currency = 'THB'
  const Row = ({ label, value, muted }) => (
    <div className={`flex justify-between gap-3 text-sm ${muted ? 'text-slate-500' : 'text-slate-700'}`}>
      <span>{label}</span>
      <span className="font-medium tabular-nums shrink-0">{formatPrice(value, currency)}</span>
    </div>
  )

  const partnerShare = n(booking?.partner_earnings_thb ?? booking?.partnerEarningsThb)

  const listing = booking?.listings || booking?.listing || {}
  const categorySlug = String(listing?.category_slug || listing?.category?.slug || '').toLowerCase()
  const meta =
    listing?.metadata && typeof listing.metadata === 'object' && !Array.isArray(listing.metadata)
      ? listing.metadata
      : {}
  const exclusionHints =
    role === 'renter' && categorySlug ? buildGuestPriceExclusionHints(categorySlug, meta) : []

  const showCatalogTop =
    b.catalogSubtotalThb > 0 && (b.durationDiscountThb > 0 || b.promoDiscountThb > 0 || b.listPriceThb > 0)
  const showListTop = !showCatalogTop && b.listPriceThb > 0 && b.discountThb > 0

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-3 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        {getUIText('orderPrice_breakdownTitle', language)}
      </p>
      {showCatalogTop ? (
        <Row label={getUIText('orderPrice_catalogSubtotal', language)} value={b.catalogSubtotalThb} />
      ) : null}
      {showListTop ? <Row label={getUIText('orderPrice_listSubtotal', language)} value={b.listPriceThb} /> : null}
      {b.durationDiscountThb > 0 ? (
        <Row label={durationDiscountLabel(b, language)} value={-b.durationDiscountThb} muted />
      ) : null}
      {b.promoDiscountThb > 0 ? (
        <Row label={promoDiscountLabel(b, language)} value={-b.promoDiscountThb} muted />
      ) : null}
      <Row label={getUIText('orderPrice_serviceTariff', language)} value={b.serviceTariffThb} />
      {n(b.taxAmountThb) > 0 ? <Row label={taxVatLineLabel(b, language)} value={b.taxAmountThb} muted /> : null}
      {b.platformFeeThb > 0 ? (
        <Row label={getUIText('orderPrice_platformFee', language)} value={b.platformFeeThb} />
      ) : null}
      {b.insuranceThb > 0 ? (
        <Row label={getUIText('orderPrice_insuranceReserve', language)} value={b.insuranceThb} muted />
      ) : null}
      {b.roundingThb !== 0 ? (
        <Row label={getUIText('orderPrice_rounding', language)} value={b.roundingThb} muted />
      ) : null}
      {exclusionHints.length > 0 ? (
        <div className="rounded-lg border border-amber-100 bg-amber-50/80 px-2.5 py-2 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900/90">
            {getUIText('orderExcluded_title', language)}
          </p>
          <ul className="text-[11px] text-amber-950/90 space-y-1 leading-snug list-disc pl-4">
            {exclusionHints.map((hint) => {
              const base = getUIText(hint.key, language)
              const line =
                hint.amountThb != null && hint.amountThb > 0
                  ? base.replace(/\{\{amount\}\}/g, formatPrice(hint.amountThb, currency))
                  : base
              return <li key={hint.key}>{line}</li>
            })}
          </ul>
        </div>
      ) : null}
      <p className="text-[11px] text-slate-500 leading-snug border-t border-slate-100/80 pt-2">
        {n(b.taxAmountThb) > 0
          ? getUIText('orderPrice_taxesNoteWithVatLine', language)
          : getUIText('orderPrice_taxesNote', language)}
      </p>
      <div className="border-t border-slate-200 pt-2 flex justify-between gap-3 text-sm font-semibold text-slate-900">
        <span>
          {role === 'partner'
            ? getUIText('orderPrice_totalGuestPaid', language)
            : getUIText('orderPrice_totalYouPay', language)}
        </span>
        <span className="text-teal-800 tabular-nums">{formatPrice(b.totalThb, currency)}</span>
      </div>
      {role === 'partner' && partnerShare > 0 ? (
        <div className="flex justify-between gap-3 text-xs text-slate-600 pt-1 border-t border-dashed border-slate-200">
          <span>{getUIText('orderPrice_partnerShare', language)}</span>
          <span className="font-medium text-teal-700 tabular-nums">{formatPrice(partnerShare, currency)}</span>
        </div>
      ) : null}
    </div>
  )
}
