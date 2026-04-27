'use client'

import { Button } from '@/components/ui/button'
import { Loader2, LifeBuoy, Check, X } from 'lucide-react'
import { getUIText } from '@/lib/translations'

/** Partner confirm / decline / complete + help (same dispute/help entry as renter). */
export function OrderCardPartnerActions({
  language,
  booking,
  bookingId,
  isBusy,
  onConfirm,
  onDecline,
  onComplete,
  onOpenHelp,
  showConfirm,
  showDecline,
  showComplete,
}) {
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {showConfirm ? (
        <Button type="button" onClick={() => onConfirm?.(booking)} disabled={isBusy} className="bg-green-600 hover:bg-green-700">
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
          {getUIText('orderAction_confirm', language)}
        </Button>
      ) : null}

      {showDecline ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => onDecline?.(booking)}
          disabled={isBusy}
          className="text-red-700 border-red-200 hover:bg-red-50"
        >
          <X className="h-4 w-4 mr-2" />
          {getUIText('orderAction_decline', language)}
        </Button>
      ) : null}

      {showComplete ? (
        <Button type="button" variant="outline" onClick={() => onComplete?.(booking)} disabled={isBusy}>
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
          {getUIText('orderAction_complete', language)}
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
