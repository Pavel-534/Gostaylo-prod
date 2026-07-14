'use client'

import { Button } from '@/components/ui/button'
import { Receipt } from 'lucide-react'
import { formatPrice } from '@/lib/currency'
import { getUIText } from '@/lib/translations'
import { OrderPriceBreakdown } from '@/components/orders/OrderPriceBreakdown'
import { PartnerFinancialSnapshotDialog } from '@/components/partner/PartnerFinancialSnapshotDialog'
import { PartnerHostLedgerAmount } from '@/components/partner/finances/partner-host-amount-display'
import { resolvePartnerOrderFooterAmounts } from '@/lib/partner/partner-booking-card-model'

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
  compact = false,
}) {
  if (normalizedRole === 'partner') {
    const { guestPaid, netEarnings } = resolvePartnerOrderFooterAmounts(booking, partnerEarnings)
    if (compact) {
      if (netEarnings == null) return null
      return (
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <p className="text-sm text-slate-600">{getUIText('netEarnings', language)}</p>
          <p className="text-lg font-semibold text-brand-hover tabular-nums">
            <PartnerHostLedgerAmount thb={netEarnings} />
          </p>
        </div>
      )
    }
    return (
      <div className="flex items-start justify-between gap-3 pt-3 border-t">
        <div>
          <p className="text-sm text-slate-600 mb-1">{getUIText('partnerOrderCard_guestPaid', language)}</p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">
            {guestPaid != null ? <PartnerHostLedgerAmount thb={guestPaid} /> : '—'}
          </p>
        </div>
        {netEarnings != null ? (
          <div className="text-right">
            <p className="text-sm text-slate-500 mb-1">{getUIText('netEarnings', language)}</p>
            <p className="text-lg font-semibold text-brand-hover tabular-nums">
              <PartnerHostLedgerAmount thb={netEarnings} />
            </p>
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
