'use client'

import { Label } from '@/components/ui/label'
import { TimeSelect } from '@/components/ui/time-select'
import { PlatformCalendar } from '@/components/platform-calendar'
import { GuestCountStepper } from '@/components/listing/GuestCountStepper'
import { isTransportListingCategory } from '@/lib/listing-category-slug'

export function BookingDateGuestsPicker({
  listing,
  language,
  rentalPeriodMode,
  tx,
  calendarKey,
  dateRange,
  setDateRange,
  guests,
  setGuests,
  maxGuests,
  vehicleStartTime = '07:00',
  vehicleEndTime = '07:00',
  onVehicleStartTimeChange,
  onVehicleEndTimeChange,
}) {
  const isTransport = isTransportListingCategory(listing?.categorySlug || listing?.category?.slug)

  return (
    <>
      <div>
        <Label className="text-sm font-medium mb-2 block">
          {tx(rentalPeriodMode === 'day' ? 'travelDatesRental' : 'travelDates')}
        </Label>
        <PlatformCalendar
          key={calendarKey}
          listingId={listing.id}
          value={dateRange}
          onChange={setDateRange}
          minStay={listing.minStay}
          language={language}
          guests={guests}
          listingMaxCapacity={listing.maxCapacity}
          rentalPeriodMode={rentalPeriodMode}
        />
      </div>

      {isTransport && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-slate-600 mb-1.5 block">
              {language === 'ru' ? 'Время начала' : 'Start time'}
            </Label>
            <TimeSelect value={vehicleStartTime} onChange={onVehicleStartTimeChange} className="h-9" />
          </div>
          <div>
            <Label className="text-xs text-slate-600 mb-1.5 block">
              {language === 'ru' ? 'Время окончания' : 'End time'}
            </Label>
            <TimeSelect value={vehicleEndTime} onChange={onVehicleEndTimeChange} className="h-9" />
          </div>
        </div>
      )}

      <div>
        <Label className="text-sm font-medium mb-2 block">
          {tx(rentalPeriodMode === 'day' ? 'numberOfSeats' : 'numberOfGuests')}
        </Label>
        <GuestCountStepper value={guests} onChange={setGuests} min={1} max={maxGuests} />
      </div>
    </>
  )
}
