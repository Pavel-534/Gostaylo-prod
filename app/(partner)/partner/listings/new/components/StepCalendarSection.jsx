'use client'

import { memo } from 'react'
import { isTransportListingCategory } from '@/lib/listing-category-slug'
import CalendarSyncManager from '@/components/calendar-sync-manager'
import AvailabilityCalendar from '@/components/availability-calendar'
import SeasonalPriceManager from '@/components/seasonal-price-manager'
import { PartnerSectionDivider } from '@/components/partner/PartnerSectionDivider'
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
      className="max-sm:min-w-0 max-sm:overflow-x-hidden"
      aria-labelledby="partner-listing-calendar-heading"
      data-testid="wizard-calendar-section"
    >
      <div id="partner-calendar-sync" className="scroll-mt-28">
        <div id="partner-listing-calendar" className="space-y-0">
          <h2 id="partner-listing-calendar-heading" className="sr-only">
            {t('partnerCal_mainTitle')}
          </h2>
          {transport ? null : (
            <>
              <div data-partner-section="calendar-sync">
                <CalendarSyncManager listingId={listingId} onSync={() => {}} />
              </div>
              <PartnerSectionDivider />
            </>
          )}
          <div data-partner-section="calendar-blocks">
            <AvailabilityCalendar listingId={listingId} syncErrors={[]} />
          </div>
          <PartnerSectionDivider />
          <div data-partner-section="calendar-seasons">
            <SeasonalPriceManager
              listingId={listingId}
              basePriceThb={basePrice}
              baseCurrency={baseCurrency}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

export const StepCalendarSection = memo(StepCalendarSectionInner)
