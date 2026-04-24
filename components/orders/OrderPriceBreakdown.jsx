'use client'

import { formatPrice } from '@/lib/currency'
import { getUIText } from '@/lib/translations'
import { buildGuestPriceBreakdownFromBooking } from '@/lib/booking/guest-price-breakdown'

function n(x) {
  const v = Number(x)
  return Number.isFinite(v) ? v : 0
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

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-3 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        {getUIText('orderPrice_breakdownTitle', language)}
      </p>
      {b.listPriceThb > 0 && b.discountThb > 0 ? (
        <Row label={getUIText('orderPrice_listSubtotal', language)} value={b.listPriceThb} />
      ) : null}
      {b.discountThb > 0 ? (
        <Row
          label={getUIText('orderPrice_promoDiscount', language)}
          value={-b.discountThb}
          muted
        />
      ) : null}
      <Row label={getUIText('orderPrice_serviceTariff', language)} value={b.serviceTariffThb} />
      {b.platformFeeThb > 0 ? (
        <Row label={getUIText('orderPrice_platformFee', language)} value={b.platformFeeThb} />
      ) : null}
      {b.insuranceThb > 0 ? (
        <Row label={getUIText('orderPrice_insuranceReserve', language)} value={b.insuranceThb} muted />
      ) : null}
      {b.roundingThb !== 0 ? (
        <Row label={getUIText('orderPrice_rounding', language)} value={b.roundingThb} muted />
      ) : null}
      <p className="text-[11px] text-slate-500 leading-snug border-t border-slate-100/80 pt-2">
        {getUIText('orderPrice_taxesNote', language)}
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
