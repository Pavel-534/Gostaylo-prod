'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getUIText } from '@/lib/translations'
import { RENTER_CHECKOUT_NO_CANCEL_STATUSES } from '@/lib/config/app-constants'
import { OrderPriceBreakdown } from '@/components/orders/OrderPriceBreakdown'

function canRenterCancelCheckout(status) {
  return !RENTER_CHECKOUT_NO_CANCEL_STATUSES.has(String(status || '').toUpperCase())
}

/**
 * @param {object} p — useCheckoutPayment result
 * @param {object} c — useCheckoutPricing result
 * @param {() => void} onOpenCancel
 */
export function CheckoutSummary({ p, c, onOpenCancel }) {
  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{getUIText('checkout_orderTitle', c.language)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="font-semibold text-slate-900">{p.listing?.title}</p>
            <p className="text-sm text-slate-600 mt-1">
              {new Date(p.booking.checkIn).toLocaleDateString(c.dateNumberLocale)} –{' '}
              {new Date(p.booking.checkOut).toLocaleDateString(c.dateNumberLocale)}
            </p>
            {p.invoice?.id && (
              <p className="text-xs text-slate-500 mt-1">
                Invoice #{String(p.invoice.id).slice(-8)} • {String(p.invoice.currency || 'THB').toUpperCase()}
              </p>
            )}
          </div>

          <div className="border-t pt-4 space-y-2">
            {!c.hasInvoiceCheckout && c.guestCheckoutBreakdown?.hasDetail ? (
              <div
                data-test-checkout-breakdown
                data-test-subtotal-value={c.priceRawForTest(p.booking.priceThb, 'THB')}
                data-test-fee-value={c.priceRawForTest(c.serviceFee, 'THB')}
                data-test-raw-value={c.priceRawForTest(c.totalWithFee, 'THB')}
                data-test-total-thb={String(Math.round(Number(c.totalWithFee) || 0))}
              >
                <OrderPriceBreakdown
                  booking={p.booking}
                  breakdown={c.guestCheckoutBreakdown}
                  language={c.language}
                  role="renter"
                />
              </div>
            ) : null}
            {c.hasInvoiceCheckout ? (
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>{getUIText('checkout_total', c.language)}</span>
                <span
                  className="text-teal-600"
                  data-test-raw-value={String(c.invoiceAmount)}
                  data-test-total-thb={String(
                    Math.round(Number(p.invoice?.amount_thb || c.totalWithFee) || 0),
                  )}
                >
                  {c.payableText}
                </span>
              </div>
            ) : null}
            {canRenterCancelCheckout(p.booking.status) && (
              <Button
                type="button"
                variant="outline"
                className="w-full mt-3 border-red-200 text-red-700 hover:bg-red-50"
                onClick={onOpenCancel}
              >
                {getUIText('renterCancel_button', c.language)}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
