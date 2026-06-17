'use client'

import { Button } from '@/components/ui/button'
import { Receipt } from 'lucide-react'
import { formatPrice } from '@/lib/currency'
import { getUIText } from '@/lib/translations'
import { buildGuestPriceBreakdownFromBooking } from '@/lib/booking/guest-price-breakdown'
import { OrderPriceBreakdown } from '@/components/orders/OrderPriceBreakdown'
import { PartnerFinancialSnapshotDialog } from '@/components/partner/PartnerFinancialSnapshotDialog'

/** Partner order card footer — SSOT: snapshot → breakdown → booking columns. */
function resolvePartnerOrderFooterAmounts(booking, partnerEarnings) {
  const snap = booking?.financial_snapshot
  let guestPaid = null
  if (snap && typeof snap === 'object') {
    const gp = Number(snap.guestPayableThb)
    if (Number.isFinite(gp) && gp > 0) guestPaid = gp
  }
  if (guestPaid == null) {
    const breakdown = buildGuestPriceBreakdownFromBooking(booking)
    if (breakdown.hasDetail && breakdown.totalThb > 0) guestPaid = breakdown.totalThb
  }
  if (guestPaid == null) {
    const paid = Number(booking?.price_paid ?? booking?.pricePaid)
    const thb = Number(booking?.price_thb ?? booking?.priceThb)
    const fallback = Number.isFinite(paid) && paid > 0 ? paid : thb
    if (Number.isFinite(fallback) && fallback > 0) guestPaid = fallback
  }

  let net = Number(partnerEarnings)
  if (!Number.isFinite(net) && snap && typeof snap === 'object') {
    net = Number(snap.partnerPayoutThb ?? snap.net ?? snap.partner_earnings_thb)
  }
  if (!Number.isFinite(net)) {
    net = Number(booking?.partner_earnings_thb ?? booking?.partnerEarningsThb)
  }

  return {
    guestPaid: Number.isFinite(guestPaid) && guestPaid > 0 ? guestPaid : null,
    netEarnings: Number.isFinite(net) && net > 0 ? net : null,
  }
}

/**
 * Price breakdown, partner financial snapshot entry, footer totals row.
 */
export function OrderCardFinancials({
  booking,
  language,
  normalizedRole,
  partnerFinanceOpen,
  setPartnerFinanceOpen,
  title,
  bookingId,
  status,
}) {
  return (
    <>
      <OrderPriceBreakdown
        booking={booking}
        language={language}
        role={normalizedRole === 'partner' ? 'partner' : 'renter'}
      />

      {normalizedRole === 'partner' && booking?.financial_snapshot ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto gap-2 border-brand/25 text-brand hover:bg-brand/10"
            onClick={() => setPartnerFinanceOpen(true)}
          >
            <Receipt className="h-4 w-4 shrink-0" aria-hidden />
            {getUIText('partnerFinancial_openBreakdown', language)}
          </Button>
          <PartnerFinancialSnapshotDialog
            open={partnerFinanceOpen}
            onOpenChange={setPartnerFinanceOpen}
            snapshot={booking.financial_snapshot}
            bookingTitle={title}
            bookingId={bookingId}
            status={status}
            language={language}
          />
        </>
      ) : null}
    </>
  )
}

/** Footer totals + partner share (placed after escrow / guest contact blocks in `UnifiedOrderCard`). */
export function OrderCardFinancialTotals({
  booking,
  language,
  normalizedRole,
  normalizedOrder,
  partnerEarnings,
  hasUnifiedTotal,
}) {
  if (normalizedRole === 'partner') {
    const { guestPaid, netEarnings } = resolvePartnerOrderFooterAmounts(booking, partnerEarnings)
    return (
      <div className="flex items-start justify-between gap-3 pt-3 border-t">
        <div>
          <p className="text-sm text-slate-600 mb-1">{getUIText('partnerOrderCard_guestPaid', language)}</p>
          <p className="text-2xl font-bold text-slate-900">
            {guestPaid != null ? formatPrice(guestPaid, 'THB') : '—'}
          </p>
        </div>
        {netEarnings != null ? (
          <div className="text-right">
            <p className="text-sm text-slate-500 mb-1">{getUIText('netEarnings', language)}</p>
            <p className="text-lg font-semibold text-brand-hover">{formatPrice(netEarnings, 'THB')}</p>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex items-start justify-between gap-3 pt-3 border-t">
      <div>
        <p className="text-sm text-slate-600 mb-1">{getUIText('checkout_total', language)}</p>
        <p className="text-2xl font-bold text-slate-900">
          {hasUnifiedTotal ? formatPrice(normalizedOrder.total_price, normalizedOrder.currency) : '—'}
        </p>
      </div>
    </div>
  )
}
