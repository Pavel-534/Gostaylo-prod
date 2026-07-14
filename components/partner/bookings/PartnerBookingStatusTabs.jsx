'use client'

import { getUIText } from '@/lib/translations'
import { PARTNER_BOOKING_TAB_IDS, partnerBookingTabLabelKey } from '@/lib/booking/partner-bookings-tabs'
import { PartnerFinancesPillSubNav } from '@/components/partner/finances/PartnerFinancesPillSubNav'

/**
 * Horizontal scrollable status tabs for partner bookings (Stage 185.1).
 */
export function PartnerBookingStatusTabs({ activeTab = 'all', counters = {}, onChange, language = 'ru' }) {
  const tabs = PARTNER_BOOKING_TAB_IDS.map((tab) => {
    const count = counters?.[tab] ?? 0
    const label = getUIText(partnerBookingTabLabelKey(tab), language)
    return {
      id: tab,
      label: count > 0 ? `${label} (${count})` : label,
    }
  })

  return (
    <PartnerFinancesPillSubNav
      ariaLabel={getUIText('partnerBookings_statusTabsAria', language)}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={onChange}
    />
  )
}
