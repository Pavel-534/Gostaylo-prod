'use client'

import nextDynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'

const DealDetailsCard = nextDynamic(
  () => import('@/components/chat/DealDetailsCard').then((m) => m.DealDetailsCard),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[12rem] w-full items-center justify-center rounded-xl border border-slate-100 bg-slate-50/80">
        <Loader2 className="h-7 w-7 animate-spin text-teal-600" />
      </div>
    ),
  },
)

/**
 * Right column: listing + booking summary (deal card).
 */
export function BookingInfoSidebar({ listing, booking, language, onOpenCalendar, className }) {
  if (!listing && !booking) return null
  return (
    <DealDetailsCard
      listing={listing}
      booking={booking}
      language={language}
      className={className}
      onOpenCalendar={onOpenCalendar}
    />
  )
}
