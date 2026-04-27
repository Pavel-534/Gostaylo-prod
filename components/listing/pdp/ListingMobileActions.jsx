'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { GostayloCalendar } from '@/components/gostaylo-calendar'
import { GuestCountStepper } from '@/components/listing/GuestCountStepper'
import { MobileBookingBar, PriceBreakdownBlock } from '@/app/listings/[id]/components/BookingWidget'
import { getUIText } from '@/lib/translations'

/**
 * PDP mobile: inline date/guest planner (lg:hidden) + fixed bottom **`MobileBookingBar`**.
 */
export function ListingMobileActions({
  listing,
  language,
  currency,
  exchangeRates,
  dateRange,
  setDateRange,
  guests,
  setGuests,
  calendarKey,
  listingRentalPeriodMode,
  maxGuests,
  hasDurationDiscountTiers,
  durationDiscountPercentActive,
  wholeVesselListing,
  bookingUiMode,
  availabilityLoading,
  availabilitySnapshot,
  exclusiveDatesUnavailable,
  priceCalc,
  onAskPartnerUnavailable,
  user,
  openLoginModal,
  openBookModal,
  mobileBarProps,
}) {
  const listingCategorySlug = listing?.categorySlug || listing?.category?.slug || ''
  const uiCtx = listingCategorySlug ? { listingCategorySlug } : undefined
  const tx = (k) => getUIText(k, language, uiCtx)

  return (
    <>
      <div className="lg:hidden">
        <h2 className="text-2xl font-medium tracking-tight mb-4">{tx('selectYourDates')}</h2>
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="p-4 space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">
                {tx(listingRentalPeriodMode === 'day' ? 'travelDatesRental' : 'travelDates')}
              </Label>
              <GostayloCalendar
                key={calendarKey}
                listingId={listing.id}
                value={dateRange}
                onChange={setDateRange}
                minStay={listing.minStay}
                language={language}
                guests={guests}
                listingMaxCapacity={listing.maxCapacity}
                rentalPeriodMode={listingRentalPeriodMode}
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">
                {tx(listingRentalPeriodMode === 'day' ? 'numberOfSeats' : 'numberOfGuests')}
              </Label>
              <GuestCountStepper value={guests} onChange={setGuests} min={1} max={maxGuests} />
            </div>
            {hasDurationDiscountTiers && durationDiscountPercentActive > 0 && (
              <div className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-sm text-emerald-900">
                <span>
                  {tx(
                    listingRentalPeriodMode === 'day'
                      ? 'durationDiscountTeaserActiveDay'
                      : 'durationDiscountTeaserActiveNight',
                  ).replace(/\{\{pct\}\}/g, String(durationDiscountPercentActive))}
                </span>
              </div>
            )}
            {wholeVesselListing && dateRange?.from && dateRange?.to && (
              <div className="text-sm text-teal-900 bg-teal-50/80 border border-teal-100 rounded-lg px-3 py-2">
                {availabilityLoading ? (
                  <span>{tx('listingDetail_checkingAvailability')}</span>
                ) : availabilitySnapshot != null ? (
                  <span>
                    {availabilitySnapshot.available
                      ? tx('listingDetail_vesselAvailable')
                      : tx('listingDetail_vesselUnavailable')}
                  </span>
                ) : null}
              </div>
            )}
            {bookingUiMode === 'shared' && !wholeVesselListing && dateRange?.from && dateRange?.to && (
              <div className="text-sm text-teal-900 bg-teal-50/80 border border-teal-100 rounded-lg px-3 py-2">
                {availabilityLoading ? (
                  <span>{tx('listingDetail_checkingSpots')}</span>
                ) : availabilitySnapshot?.remaining_spots != null ? (
                  <span>
                    {tx('listingDetail_spotsLabel')}: <strong>{availabilitySnapshot.remaining_spots}</strong>
                    {listing.maxCapacity > 1 ? ` / ${listing.maxCapacity}` : ''}
                  </span>
                ) : null}
              </div>
            )}
            {exclusiveDatesUnavailable && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                {tx('listingDetail_datesUnavailable')}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full mt-2 border-teal-300"
                  onClick={onAskPartnerUnavailable}
                >
                  {tx('listingDetail_askPartnerChat')}
                </Button>
              </div>
            )}
            {bookingUiMode === 'shared' && dateRange?.from && dateRange?.to && (
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full border border-teal-200"
                  onClick={() => (user ? openBookModal('private') : openLoginModal())}
                >
                  {tx('listingDetail_privateTrip')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-dashed"
                  onClick={() => (user ? openBookModal('special') : openLoginModal())}
                >
                  {tx('listingDetail_specialPrice')}
                </Button>
              </div>
            )}
            {priceCalc && (
              <div className="bg-white p-4 rounded-lg">
                <PriceBreakdownBlock
                  priceCalc={priceCalc}
                  currency={currency}
                  exchangeRates={exchangeRates}
                  language={language}
                  rentalPeriodMode={listingRentalPeriodMode}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <MobileBookingBar listing={listing} {...mobileBarProps} />
    </>
  )
}
