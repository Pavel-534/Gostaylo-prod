'use client'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getUIText } from '@/lib/translations'
import { PARTNER_BOOKING_TAB_IDS, partnerBookingTabLabelKey } from '@/lib/booking/partner-bookings-tabs'
import { cn } from '@/lib/utils'

const TAB_TRIGGER_CLASS =
  'rounded-lg shrink-0 snap-start scroll-mx-2 min-h-[44px] px-3 data-[state=active]:bg-brand data-[state=active]:text-white'

const TABS_LIST_CLASS =
  'mb-4 flex w-full overflow-x-auto h-auto gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm scrollbar-thin snap-x snap-proximity scroll-pl-2 scroll-pr-2 [-webkit-overflow-scrolling:touch]'

/**
 * Horizontal status tabs for partner bookings (replaces status Select).
 */
export function PartnerBookingStatusTabs({ activeTab = 'all', counters = {}, onChange, language = 'ru' }) {
  return (
    <Tabs value={activeTab} onValueChange={onChange} className="w-full">
      <TabsList className={TABS_LIST_CLASS}>
        {PARTNER_BOOKING_TAB_IDS.map((tab) => {
          const count = counters?.[tab] ?? 0
          const label = getUIText(partnerBookingTabLabelKey(tab), language)
          return (
            <TabsTrigger key={tab} value={tab} className={cn(TAB_TRIGGER_CLASS, 'text-sm')}>
              {label}
              {count > 0 ? <span className="ml-1.5 tabular-nums opacity-80">({count})</span> : null}
            </TabsTrigger>
          )
        })}
      </TabsList>
    </Tabs>
  )
}
