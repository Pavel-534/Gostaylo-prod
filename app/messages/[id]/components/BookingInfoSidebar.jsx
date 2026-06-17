'use client'

import nextDynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'
import { GuestBookingNextStepsCard } from '@/components/guest/GuestBookingNextStepsCard'

const DealDetailsCard = nextDynamic(
  () => import('@/components/chat/DealDetailsCard').then((m) => m.DealDetailsCard),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[12rem] w-full items-center justify-center rounded-xl border border-slate-100 bg-slate-50/80">
        <Loader2 className="h-7 w-7 animate-spin text-brand" />
      </div>
    ),
  },
)

/**
 * Right column: listing + booking summary (deal card).
 */
export function BookingInfoSidebar({ listing, booking, language, isHosting = false, onOpenCalendar, className }) {
  if (!listing && !booking) return null

  const categorySlug =
    listing?.category_slug ||
    listing?.categorySlug ||
    booking?.category_slug ||
    booking?.listings?.category_slug ||
    null
  const wizardProfile = listing?.wizard_profile || listing?.wizardProfile || null
  const conversationId = booking?.conversation_id || booking?.conversationId || null
  const chatHref = conversationId ? `/messages/${encodeURIComponent(String(conversationId))}` : null
  const payHref = booking?.id ? `/checkout/${encodeURIComponent(String(booking.id))}` : null

  return (
    <div className={className ? `${className} flex flex-col gap-4` : 'flex flex-col gap-4'}>
      {!isHosting && booking?.status ? (
        <GuestBookingNextStepsCard
          bookingId={booking?.id}
          status={booking.status}
          language={language}
          categorySlug={categorySlug}
          wizardProfile={wizardProfile}
          chatHref={chatHref}
          payHref={payHref}
          compact
          surface="chat"
        />
      ) : null}
      <DealDetailsCard
        listing={listing}
        booking={booking}
        language={language}
        isHosting={isHosting}
        onOpenCalendar={onOpenCalendar}
      />
    </div>
  )
}
