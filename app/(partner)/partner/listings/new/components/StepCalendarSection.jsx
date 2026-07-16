'use client'

import { memo } from 'react'
import { isTransportListingCategory } from '@/lib/listing-category-slug'
import CalendarSyncManager from '@/components/calendar-sync-manager'
import AvailabilityCalendar from '@/components/availability-calendar'
import SeasonalPriceManager from '@/components/seasonal-price-manager'
import { useListingWizard } from '../context/ListingWizardContext'

function StepCalendarSectionInner() {
  const { editId, serverListing, formData, listingCategorySlug, t } = useListingWizard()

  if (!editId || !serverListing) return null

  const transport = isTransportListingCategory(listingCategorySlug)
  const basePrice = parseFloat(String(formData?.basePriceThb || '').replace(',', '.')) || 0

  return (
    <section
      className="mt-10 space-y-6 border-t border-slate-200/90 pt-10 max-sm:min-w-0 max-sm:overflow-x-hidden"
      aria-labelledby="partner-listing-calendar-heading"
    >
      <div id="partner-listing-calendar" className="scroll-mt-28 max-sm:space-y-4">
        <h2 id="partner-listing-calendar-heading" className="sr-only">
          {t('partnerCal_mainTitle')}
        </h2>
        {transport ? null : (
          <CalendarSyncManager listingId={editId} onSync={() => {}} />
        )}
        <AvailabilityCalendar listingId={editId} syncErrors={[]} />
        <SeasonalPriceManager listingId={editId} basePriceThb={basePrice} />
      </div>
    </section>
  )
}

export const StepCalendarSection = memo(StepCalendarSectionInner)
