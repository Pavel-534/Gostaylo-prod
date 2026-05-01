import { CalendarService } from '@/lib/services/calendar.service'
import { resolveListingGuestCapacity } from '@/lib/listing-guest-capacity'

export async function filterListingsByAvailability(listings, filters) {
  let filteredOutByAvailability = 0
  let filteredOutByAvailabilityErrors = 0
  let filteredOutByCapacity = 0
  const hasDateFilter = !!(filters.checkIn && filters.checkOut)

  const capacityCandidates = []
  for (const listing of listings) {
    const isVehicleListing = String(listing?.categories?.slug || '').toLowerCase() === 'vehicles'
    if (filters.guests && !isVehicleListing) {
      const maxGuests = resolveListingGuestCapacity(listing)
      if (maxGuests < filters.guests) {
        filteredOutByCapacity++
        continue
      }
    }
    capacityCandidates.push(listing)
  }

  let availableListings = []
  if (!hasDateFilter) {
    availableListings = capacityCandidates
  } else if (capacityCandidates.length > 0) {
    const bookedOutIds = new Set()

    try {
      const batch = await CalendarService.checkBatchAvailability(
        capacityCandidates.map((l) => l.id),
        filters.checkIn,
        filters.checkOut,
        {
          guestsCount: Math.max(1, parseInt(filters.guests, 10) || 1),
        },
      )

      if (!batch?.success) {
        filteredOutByAvailabilityErrors += capacityCandidates.length
        console.error(
          '[SEARCH API] CRITICAL: batch availability RPC failed; excluding all candidates (overbooking risk if shown).',
          batch?.error || 'BATCH_AVAILABILITY_RPC_FAILED',
        )
      } else {
        for (const listing of capacityCandidates) {
          const row = batch.results?.get?.(String(listing.id))
          if (!row) {
            filteredOutByAvailabilityErrors += 1
            console.error(
              `[SEARCH API] CRITICAL: batch availability returned no row for listing ${listing.id}; excluding from results.`,
            )
            continue
          }
          if (!row.available) {
            filteredOutByAvailability++
            bookedOutIds.add(listing.id)
            continue
          }
          listing._pricing = row.pricing || null
          availableListings.push(listing)
        }
      }
    } catch (err) {
      filteredOutByAvailabilityErrors += capacityCandidates.length
      console.error(
        '[SEARCH API] CRITICAL: batch availability threw; excluding all candidates (overbooking risk if shown).',
        err?.message || err,
      )
    }

    const SOFT_FILTER_MIN = 3
    if (availableListings.length < SOFT_FILTER_MIN && bookedOutIds.size > 0) {
      const mismatchListings = capacityCandidates.filter((l) => bookedOutIds.has(l.id))
      for (const l of mismatchListings) {
        l._isAvailabilityMismatch = true
        availableListings.push(l)
      }
    }
  }

  return {
    availableListings,
    filteredOutByAvailability,
    filteredOutByAvailabilityErrors,
    filteredOutByCapacity,
    hasDateFilter,
  }
}
