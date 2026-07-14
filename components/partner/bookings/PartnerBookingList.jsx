'use client'

import Link from 'next/link'
import { Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getUIText } from '@/lib/translations'
import { WorkspaceEmptyState } from '@/components/empty-state'
import { PartnerBookingCard } from '@/components/partner/bookings/PartnerBookingCard'
import { PartnerBookingDetailDrawer } from '@/components/partner/bookings/PartnerBookingDetailDrawer'

/**
 * Master list + detail drawer for partner bookings.
 */
export function PartnerBookingList({
  bookings = [],
  language = 'ru',
  activeTab = 'all',
  selectedBookingId = null,
  drawerOpen = false,
  onDrawerOpenChange,
  onSelectBooking,
  isBusy = false,
  onConfirm,
  onDecline,
  onComplete,
  onQuickConfirm,
}) {
  const selectedBooking =
    bookings.find((b) => String(b.id) === String(selectedBookingId)) || null

  return (
    <>
      {bookings.length === 0 ? (
        <WorkspaceEmptyState
          icon={Inbox}
          title={getUIText('partnerBookings_emptyTitle', language)}
          hint={
            activeTab !== 'all'
              ? getUIText('partnerBookings_emptyFiltered', language)
              : getUIText('partnerBookings_emptyHint', language)
          }
        />
      ) : (
        <div className="space-y-2">
          {bookings.map((booking) => (
            <div key={booking.id}>
              <PartnerBookingCard
                booking={booking}
                language={language}
                selected={drawerOpen && String(selectedBookingId) === String(booking.id)}
                isBusy={isBusy}
                onOpen={(b) => onSelectBooking?.(b.id)}
                onQuickConfirm={onQuickConfirm}
              />
              {booking.canSubmitGuestReview ? (
                <div className="mt-2 pl-1">
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="min-h-[44px] border-amber-200 text-amber-900 hover:bg-amber-50"
                  >
                    <Link href={`/partner/bookings/${encodeURIComponent(booking.id)}/guest-review`}>
                      {getUIText('partnerBreadcrumb_reviews', language)}
                    </Link>
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <PartnerBookingDetailDrawer
        booking={selectedBooking}
        open={drawerOpen && !!selectedBooking}
        onOpenChange={onDrawerOpenChange}
        language={language}
        isBusy={isBusy}
        onConfirm={onConfirm}
        onDecline={onDecline}
        onComplete={onComplete}
      />
    </>
  )
}
