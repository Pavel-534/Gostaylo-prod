'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Loader2, LifeBuoy, Star } from 'lucide-react'
import { getUIText } from '@/lib/translations'

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
  const showPayNow = Boolean(bookingId && status === 'AWAITING_PAYMENT')

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      {bookingId ? (
        <>
          {showPayNow ? (
            <>
              <Button
                asChild
                size="lg"
                className="bg-teal-600 hover:bg-teal-700 text-white shadow-md font-semibold min-w-[9.5rem]"
              >
                <Link href={`/checkout/${encodeURIComponent(bookingId)}`}>
                  {getUIText('orderAction_payNow', language)}
                </Link>
              </Button>
              <Button asChild variant="link" className="text-slate-600 h-auto px-2 py-1 text-sm shrink-0">
                <Link href={`/checkout/${encodeURIComponent(bookingId)}`}>
                  {getUIText('orderAction_details', language)}
                </Link>
              </Button>
            </>
          ) : (
            <Button asChild variant="outline">
              <Link href={`/checkout/${encodeURIComponent(bookingId)}`}>{getUIText('orderAction_details', language)}</Link>
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
          className="text-red-700 border-red-200 hover:bg-red-50"
        >
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : getUIText('orderAction_cancel', language)}
        </Button>
      ) : null}

      {showCheckIn ? (
        <Button type="button" onClick={() => onCheckIn?.(booking)} disabled={isBusy} className="bg-teal-600 hover:bg-teal-700">
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : getUIText('orderAction_checkIn', language)}
        </Button>
      ) : null}

      {showReview ? (
        <Button type="button" onClick={() => onReview?.(booking)} disabled={isBusy} className="bg-teal-600 hover:bg-teal-700">
          <Star className="h-4 w-4 mr-2" />
          {getUIText('orderAction_review', language)}
        </Button>
      ) : null}

      {showRepeat ? (
        <Button asChild variant="outline">
          <Link href={`/listings/${encodeURIComponent(String(listingId))}`}>{getUIText('orderAction_repeatBooking', language)}</Link>
        </Button>
      ) : null}

      {bookingId ? (
        <Button type="button" variant="outline" onClick={onOpenHelp}>
          <LifeBuoy className="h-4 w-4 mr-2" />
          {getUIText('orderAction_help', language)}
        </Button>
      ) : null}
    </div>
  )
}
