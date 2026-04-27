'use client'

import { Button } from '@/components/ui/button'
import { Receipt } from 'lucide-react'
import { formatPrice } from '@/lib/currency'
import { getUIText } from '@/lib/translations'
import { OrderPriceBreakdown } from '@/components/orders/OrderPriceBreakdown'
import { PartnerFinancialSnapshotDialog } from '@/components/partner/PartnerFinancialSnapshotDialog'

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
            className="w-full sm:w-auto gap-2 border-teal-200 text-teal-900 hover:bg-teal-50"
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
  language,
  normalizedRole,
  normalizedOrder,
  partnerEarnings,
  hasUnifiedTotal,
}) {
  return (
    <div className="flex items-start justify-between gap-3 pt-3 border-t">
      <div>
        <p className="text-sm text-slate-600 mb-1">
          {normalizedRole === 'partner' ? getUIText('netEarnings', language) : getUIText('checkout_total', language)}
        </p>
        <p className="text-2xl font-bold text-slate-900">
          {hasUnifiedTotal ? formatPrice(normalizedOrder.total_price, normalizedOrder.currency) : '—'}
        </p>
      </div>
      {normalizedRole === 'partner' && Number.isFinite(partnerEarnings) ? (
        <div className="text-right">
          <p className="text-sm text-slate-500 mb-1">{getUIText('yourShare', language)}</p>
          <p className="text-lg font-semibold text-teal-700">{formatPrice(partnerEarnings, 'THB')}</p>
        </div>
      ) : null}
    </div>
  )
}
