'use client'

import { memo } from 'react'
import { isTransportListingCategory } from '@/lib/listing-category-slug'
import CalendarSyncManager from '@/components/calendar-sync-manager'
import AvailabilityCalendar from '@/components/availability-calendar'
import SeasonalPriceManager from '@/components/seasonal-price-manager'
import { useListingWizard } from '../context/ListingWizardContext'

function StepCalendarSectionInner() {
  const { editId, serverListing, formData, listingCategorySlug, t, draftListingIdRef } =
    useListingWizard()

  const listingId = editId || draftListingIdRef?.current || null
  if (!listingId || !serverListing) return null

  const transport = isTransportListingCategory(listingCategorySlug)
  const basePrice = parseFloat(String(formData?.basePriceThb || '').replace(',', '.')) || 0
  const baseCurrency = String(formData?.baseCurrency || 'THB').toUpperCase()

  return (
    <section
      className="space-y-6 max-sm:min-w-0 max-sm:overflow-x-hidden"
      aria-labelledby="partner-listing-calendar-heading"
      data-testid="wizard-calendar-section"
    >
      <div id="partner-calendar-sync" className="scroll-mt-28 max-sm:space-y-4">
        <div id="partner-listing-calendar">
          <h2 id="partner-listing-calendar-heading" className="sr-only">
            {t('partnerCal_mainTitle')}
          </h2>
          {transport ? null : (
            <CalendarSyncManager listingId={listingId} onSync={() => {}} />
          )}
          <AvailabilityCalendar listingId={listingId} syncErrors={[]} />
          <SeasonalPriceManager
            listingId={listingId}
            basePriceThb={basePrice}
            baseCurrency={baseCurrency}
          />
        </div>
      </div>
    </section>
  )
}

export const StepCalendarSection = memo(StepCalendarSectionInner)
