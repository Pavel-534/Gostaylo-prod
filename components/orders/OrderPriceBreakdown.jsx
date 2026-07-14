'use client'

import { formatPrice } from '@/lib/currency'
import { getUIText } from '@/lib/translations'
import { buildGuestPriceBreakdownFromBooking } from '@/lib/booking/guest-price-breakdown'
import { buildGuestPriceExclusionHints } from '@/lib/booking/guest-price-exclusions'
import { PartnerHostLedgerAmount } from '@/components/partner/finances/partner-host-amount-display'

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

function resolvePartnerHostCommissionThb(booking) {
  const snap = booking?.financial_snapshot
  if (snap && typeof snap === 'object') {
    const host = n(snap.hostCommissionThb)
    const plat = n(snap.platformMarginThb)
    const combined = host + plat
    if (combined > 0) return combined
  }
  return 0
}

/**
 * Блок «Детализация цены» для Super-App (гость / партнёр — прозрачность).
 * Partner role: compact 3-line summary (Stage 185.1).
 * @param {{ booking?: object | null, breakdown?: object | null, language?: string, role?: 'renter' | 'partner' }} props
 */
export function OrderPriceBreakdown({ booking, breakdown = null, language = 'ru', role = 'renter' }) {
  const b = breakdown && typeof breakdown === 'object' ? breakdown : buildGuestPriceBreakdownFromBooking(booking)
  if (!b.hasDetail) return null

  const currency = 'THB'
  const isPartner = role === 'partner'
  const AmountCell = ({ value, strong = false }) => (
    <span className={strong ? 'font-bold' : 'font-medium'}>
      {isPartner ? (
        <PartnerHostLedgerAmount thb={value} />
      ) : (
        <span className="tabular-nums">{formatPrice(value, currency)}</span>
      )}
    </span>
  )

  const Row = ({ label, value, muted, strong = false }) => (
    <div
      className={`flex items-baseline justify-between gap-3 text-sm ${muted ? 'text-slate-500' : 'text-slate-700'} ${strong ? 'font-semibold text-base text-slate-900' : ''}`}
    >
      <span className="min-w-0 flex-1 pr-2">{label}</span>
      <span className="shrink-0 whitespace-nowrap text-right">
        <AmountCell value={value} strong={strong} />
      </span>
    </div>
  )

  const partnerShare = n(booking?.partner_earnings_thb ?? booking?.partnerEarningsThb)
  const hostCommissionThb = resolvePartnerHostCommissionThb(booking)

  if (isPartner) {
    return (
      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          {getUIText('orderPrice_breakdownTitle', language)}
        </p>
        <Row label={getUIText('orderPrice_totalGuestPaid', language)} value={b.totalThb} />
        {hostCommissionThb > 0 ? (
          <Row
            label={getUIText('partnerFinancial_hostCommission', language)}
            value={hostCommissionThb}
            muted
          />
        ) : null}
        {partnerShare > 0 ? (
          <div className="border-t border-slate-200 pt-2">
            <Row
              label={getUIText('orderPrice_partnerShare', language)}
              value={partnerShare}
              strong
            />
          </div>
        ) : null}
      </div>
    )
  }

  const listing = booking?.listings || booking?.listing || {}
  const categorySlug = String(listing?.category_slug || listing?.category?.slug || '').toLowerCase()
  const meta =
    listing?.metadata && typeof listing.metadata === 'object' && !Array.isArray(listing.metadata)
      ? listing.metadata
      : {}
  const exclusionHints = categorySlug ? buildGuestPriceExclusionHints(categorySlug, meta) : []

  const showCatalogTop =
    b.catalogSubtotalThb > 0 && (b.durationDiscountThb > 0 || b.promoDiscountThb > 0 || b.listPriceThb > 0)
  const showListTop = !showCatalogTop && b.listPriceThb > 0 && b.discountThb > 0

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-3">
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
        <div className="space-y-1 rounded-lg border border-amber-100 bg-amber-50/80 px-2.5 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900/90">
            {getUIText('orderExcluded_title', language)}
          </p>
          <ul className="list-disc space-y-1 pl-4 text-[11px] leading-snug text-amber-950/90">
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
      <p className="border-t border-slate-100/80 pt-2 text-[11px] leading-snug text-slate-500">
        {n(b.taxAmountThb) > 0
          ? getUIText('orderPrice_taxesNoteWithVatLine', language)
          : getUIText('orderPrice_taxesNote', language)}
      </p>
      <div className="flex items-baseline justify-between gap-3 border-t border-slate-200 pt-2 text-sm font-semibold text-slate-900">
        <span>{getUIText('orderPrice_totalYouPay', language)}</span>
        <span className="shrink-0 whitespace-nowrap text-brand-hover tabular-nums">
          {formatPrice(b.totalThb, currency)}
        </span>
      </div>
    </div>
  )
}
