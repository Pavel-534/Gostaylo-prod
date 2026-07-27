'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Loader2, LifeBuoy, Star } from 'lucide-react'
import { getUIText } from '@/lib/translations'
import { isBookingPayable } from '@/lib/booking/booking-status-rules'

const ACTION_BTN = 'min-h-11'

/** Renter-facing primary actions (pay / details / cancel / check-in / review / repeat / help). */
export function OrderCardGuestActions({
  language,
  booking,
  bookingId,
  listingId,
  status,
  isBusy,
  onCancel,
  onCheckIn,
  onReview,
  onOpenHelp,
  showCancel,
  showCheckIn,
  showReview,
  showRepeat,
}) {
  const showPayNow = Boolean(bookingId && isBookingPayable(status))

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      {bookingId ? (
        <>
          {showPayNow ? (
            <>
              <Button
                asChild
                variant="brand"
                size="lg"
                className={`${ACTION_BTN} min-w-[9.5rem] font-semibold shadow-md`}
              >
                <Link href={`/checkout/${encodeURIComponent(bookingId)}`}>
                  {getUIText('orderAction_payNow', language)}
                </Link>
              </Button>
              <Button
                asChild
                variant="link"
                className={`${ACTION_BTN} shrink-0 px-2 text-sm text-slate-600`}
              >
                <Link href={`/checkout/${encodeURIComponent(bookingId)}`}>
                  {getUIText('orderAction_details', language)}
                </Link>
              </Button>
            </>
          ) : (
            <Button asChild variant="outline" className={ACTION_BTN}>
              <Link href={`/checkout/${encodeURIComponent(bookingId)}`}>
                {getUIText('orderAction_details', language)}
              </Link>
            </Button>
          )}
        </>
      ) : null}

      {showCancel ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => onCancel?.(booking)}
          disabled={isBusy}
          className={`${ACTION_BTN} border-red-200 text-red-700 hover:bg-red-50`}
        >
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : getUIText('orderAction_cancel', language)}
        </Button>
      ) : null}

      {showCheckIn ? (
        <Button
          type="button"
          variant="brand"
          className={ACTION_BTN}
          onClick={() => onCheckIn?.(booking)}
          disabled={isBusy}
        >
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : getUIText('orderAction_checkIn', language)}
        </Button>
      ) : null}

      {showReview ? (
        <Button
          type="button"
          variant="brand"
          className={ACTION_BTN}
          onClick={() => onReview?.(booking)}
          disabled={isBusy}
        >
          <Star className="mr-2 h-4 w-4" />
          {getUIText('orderAction_review', language)}
        </Button>
      ) : null}

      {showRepeat ? (
        <Button asChild variant="outline" className={ACTION_BTN}>
          <Link href={`/listings/${encodeURIComponent(String(listingId))}`}>
            {getUIText('orderAction_repeatBooking', language)}
          </Link>
        </Button>
      ) : null}

      {bookingId ? (
        <Button type="button" variant="outline" className={ACTION_BTN} onClick={onOpenHelp}>
          <LifeBuoy className="mr-2 h-4 w-4" />
          {getUIText('orderAction_help', language)}
        </Button>
      ) : null}
    </div>
  )
}
