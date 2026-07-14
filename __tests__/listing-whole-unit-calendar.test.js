/**
 * Whole-unit calendar SSOT — lib/listing-booking-ui.js + overbooking guards
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/listing-whole-unit-calendar.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

/**
 * Mirrors buildCalendar night load for property (Stage 187.8).
 * @param {{ maxCapacity: number, bookings: { guests_count: number }[], requestedGuests: number, isWholeUnit: boolean }} p
 */
function simulateNightAvailability(p) {
  const { maxCapacity, bookings, requestedGuests, isWholeUnit } = p
  let rawBookedLoad = 0
  for (const b of bookings) {
    if (isWholeUnit) rawBookedLoad = 1
    else rawBookedLoad += Math.max(1, b.guests_count || 1)
  }
  const bookedGuests = isWholeUnit ? (rawBookedLoad > 0 ? maxCapacity : 0) : rawBookedLoad
  const remainingSpots = Math.max(0, maxCapacity - bookedGuests)
  const g = isWholeUnit ? 1 : requestedGuests
  return {
    remainingSpots,
    canCheckIn: remainingSpots >= g,
    bookedGuests,
  }
}

describe('listing whole-unit calendar (Stage 187.8)', () => {
  it('isWholeUnitCalendarInventory: property and vehicles are whole-unit', async () => {
    const { isWholeUnitCalendarInventory } = await import('../lib/listing-booking-ui.js')
    assert.equal(isWholeUnitCalendarInventory('property', {}), true)
    assert.equal(isWholeUnitCalendarInventory('vehicles', {}), true)
  })

  it('isWholeUnitCalendarInventory: tours are per-guest spots', async () => {
    const { isWholeUnitCalendarInventory } = await import('../lib/listing-booking-ui.js')
    assert.equal(isWholeUnitCalendarInventory('tours', {}), false)
  })

  it('isWholeUnitCalendarInventory: yacht charter with rent_entire_unit', async () => {
    const { isWholeUnitCalendarInventory } = await import('../lib/listing-booking-ui.js')
    assert.equal(isWholeUnitCalendarInventory('yachts', { rent_entire_unit: true }), true)
    assert.equal(isWholeUnitCalendarInventory('yachts', {}), false)
  })

  it('getListingBookingUiMode: villa is exclusive', async () => {
    const { getListingBookingUiMode } = await import('../lib/listing-booking-ui.js')
    assert.equal(getListingBookingUiMode('property', 10, {}), 'exclusive')
  })

  it('getListingBookingUiMode: tour is shared', async () => {
    const { getListingBookingUiMode } = await import('../lib/listing-booking-ui.js')
    assert.equal(getListingBookingUiMode('tours', 20, {}), 'shared')
  })

  it('overbooking: Petya 3 guests blocks Vova 7 on same villa dates (whole-unit)', () => {
    const afterPetya = simulateNightAvailability({
      maxCapacity: 10,
      bookings: [{ guests_count: 3 }],
      requestedGuests: 7,
      isWholeUnit: true,
    })
    assert.equal(afterPetya.remainingSpots, 0)
    assert.equal(afterPetya.canCheckIn, false, 'second booking must be blocked')
  })

  it('overbooking: empty villa allows 10-guest party (whole-unit needs 1 slot)', () => {
    const empty = simulateNightAvailability({
      maxCapacity: 10,
      bookings: [],
      requestedGuests: 10,
      isWholeUnit: true,
    })
    assert.equal(empty.remainingSpots, 10)
    assert.equal(empty.canCheckIn, true)
  })

  it('legacy bug: tour with 3 booked would allow 7 more (shared spots)', () => {
    const tour = simulateNightAvailability({
      maxCapacity: 10,
      bookings: [{ guests_count: 3 }],
      requestedGuests: 7,
      isWholeUnit: false,
    })
    assert.equal(tour.remainingSpots, 7)
    assert.equal(tour.canCheckIn, true, 'tours still use per-guest inventory')
  })

  it('atomic conflict: whole-unit second booking needs 1 unit, 0 remaining', () => {
    const night = simulateNightAvailability({
      maxCapacity: 10,
      bookings: [{ guests_count: 1 }],
      requestedGuests: 1,
      isWholeUnit: true,
    })
    const wouldConflict = night.bookedGuests + 1 > 10
    assert.equal(wouldConflict, true)
  })
})
