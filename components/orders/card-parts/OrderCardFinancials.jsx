'use client'

import { Button } from '@/components/ui/button'
import { Receipt } from 'lucide-react'
import { formatPrice } from '@/lib/currency'
import { getUIText } from '@/lib/translations'
import { OrderPriceBreakdown } from '@/components/orders/OrderPriceBreakdown'
import { PartnerFinancialSnapshotDialog } from '@/components/partner/PartnerFinancialSnapshotDialog'
import { PartnerHostLedgerAmount } from '@/components/partner/finances/partner-host-amount-display'
import { resolvePartnerOrderFooterAmounts } from '@/lib/partner/partner-booking-card-model'
import { cn } from '@/lib/utils'

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
            className="w-full min-h-[44px] gap-2 border-brand/25 text-brand hover:bg-brand/10 sm:w-auto"
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
  drawerFooter = false,
}) {
  if (normalizedRole === 'partner') {
    const { guestPaid, netEarnings } = resolvePartnerOrderFooterAmounts(booking, partnerEarnings)
    if (compact) {
      if (netEarnings == null) return null
      return (
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2">
          <p className="text-sm text-slate-600">{getUIText('netEarnings', language)}</p>
          <p className="whitespace-nowrap text-lg font-semibold text-brand-hover tabular-nums">
            <PartnerHostLedgerAmount thb={netEarnings} />
          </p>
        </div>
      )
    }
    const guestAmountClass = drawerFooter ? 'text-base font-bold' : 'text-2xl font-bold'
    const netAmountClass = drawerFooter ? 'text-base font-semibold' : 'text-lg font-semibold'
    return (
      <div className="grid grid-cols-2 gap-3 border-t pt-3">
        <div className="min-w-0">
          <p className="mb-0.5 text-xs text-slate-600 sm:text-sm">
            {getUIText('partnerOrderCard_guestPaid', language)}
          </p>
          <p className={cn('whitespace-nowrap tabular-nums text-slate-900', guestAmountClass)}>
            {guestPaid != null ? <PartnerHostLedgerAmount thb={guestPaid} /> : '—'}
          </p>
        </div>
        {netEarnings != null ? (
          <div className="min-w-0 text-right">
            <p className="mb-0.5 text-xs text-slate-500 sm:text-sm">{getUIText('netEarnings', language)}</p>
            <p className={cn('whitespace-nowrap tabular-nums text-brand-hover', netAmountClass)}>
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
