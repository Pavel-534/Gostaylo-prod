'use client'

import Link from 'next/link'
import { Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getUIText } from '@/lib/translations'
import { WorkspaceEmptyState } from '@/components/empty-state'
import { PartnerBookingCard } from '@/components/partner/bookings/PartnerBookingCard'
import { PartnerBookingDetailDrawer } from '@/components/partner/bookings/PartnerBookingDetailDrawer'
import { PartnerSectionDivider } from '@/components/partner/PartnerSectionDivider'
import { PARTNER_SECTION_TITLE_CLASS } from '@/lib/ui/partner-section-rhythm'
import {
  PARTNER_BOOKING_TAB_IDS,
  partnerBookingTabForStatus,
  partnerBookingTabLabelKey,
} from '@/lib/booking/partner-bookings-tabs'

/**
 * Master list + detail drawer for partner bookings.
 * Stage 200.103 — section titles + mint dividers between status groups (presentation only).
 */

function buildBookingSections(bookings, activeTab) {
  const list = Array.isArray(bookings) ? bookings : []
  if (list.length === 0) return []

  if (activeTab !== 'all') {
    return [
      {
        id: activeTab,
        titleKey: partnerBookingTabLabelKey(activeTab),
        bookings: list,
      },
    ]
  }

  const buckets = Object.fromEntries(
    PARTNER_BOOKING_TAB_IDS.filter((id) => id !== 'all').map((id) => [id, []]),
  )
  for (const booking of list) {
    const tab = partnerBookingTabForStatus(booking.status)
    if (buckets[tab]) buckets[tab].push(booking)
  }

  return PARTNER_BOOKING_TAB_IDS.filter((id) => id !== 'all' && buckets[id]?.length > 0).map(
    (id) => ({
      id,
      titleKey: partnerBookingTabLabelKey(id),
      bookings: buckets[id],
    }),
  )
}

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
  onQuickDecline,
}) {
  const selectedBooking =
    bookings.find((b) => String(b.id) === String(selectedBookingId)) || null

  const sections = buildBookingSections(bookings, activeTab)

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
        <div className="space-y-0" data-partner-section="bookings-list-groups">
          {sections.map((section, index) => (
            <div key={section.id} data-partner-section={`bookings-group-${section.id}`}>
              {index > 0 ? <PartnerSectionDivider /> : null}
              <div className="mb-3 space-y-3">
                <h3 className={PARTNER_SECTION_TITLE_CLASS}>
                  {getUIText(section.titleKey, language)}
                  <span className="ml-1.5 text-sm font-medium text-slate-500">
                    ({section.bookings.length})
                  </span>
                </h3>
                <div className="space-y-3">
                  {section.bookings.map((booking) => (
                    <div key={booking.id}>
                      <PartnerBookingCard
                        booking={booking}
                        language={language}
                        selected={drawerOpen && String(selectedBookingId) === String(booking.id)}
                        isBusy={isBusy}
                        onOpen={(b) => onSelectBooking?.(b.id)}
                        onQuickConfirm={onQuickConfirm}
                        onQuickDecline={onQuickDecline}
                      />
                      {booking.canSubmitGuestReview ? (
                        <div className="mt-2 pl-1">
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="min-h-[44px] border-amber-200/80 text-amber-900 hover:bg-amber-50"
                          >
                            <Link
                              href={`/partner/bookings/${encodeURIComponent(booking.id)}/guest-review`}
                            >
                              {getUIText('partnerBreadcrumb_reviews', language)}
                            </Link>
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
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
