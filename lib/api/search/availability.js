import { CalendarService } from '@/lib/services/calendar.service'
import { resolveListingGuestCapacity } from '@/lib/listing-guest-capacity'

export async function filterListingsByAvailability(listings, filters, options = {}) {
  const allowSoftMismatch = options.allowSoftMismatch !== false
  let filteredOutByAvailability = 0
  let filteredOutByAvailabilityErrors = 0
  let filteredOutByCapacity = 0
  const hasDateFilter = Boolean(
    filters.checkIn &&
      filters.checkOut &&
      String(filters.checkIn) < String(filters.checkOut),
  )

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
  const appendAsAvailabilityMismatch = (sourceListings) => {
    for (const item of sourceListings) {
      if (allowSoftMismatch) item._isAvailabilityMismatch = true
      availableListings.push(item)
    }
  }
  if (!hasDateFilter) {
    availableListings = capacityCandidates
  } else if (capacityCandidates.length > 0) {
    const bookedOutIds = new Set()
    const unresolvedUnavailableCandidates = []
    const guestsCount = Math.max(1, parseInt(filters.guests, 10) || 1)

    try {
      const batch = await CalendarService.checkBatchAvailability(
        capacityCandidates.map((l) => l.id),
        filters.checkIn,
        filters.checkOut,
        {
          guestsCount,
        },
      )

      if (!batch?.success) {
        filteredOutByAvailabilityErrors += capacityCandidates.length
        console.error(
          '[SEARCH API] CRITICAL: batch availability RPC failed; falling back to mismatch-tagged candidates.',
          batch?.error || 'BATCH_AVAILABILITY_RPC_FAILED',
        )
        // UX fail-open: do not blank the catalog on transient RPC failure.
        appendAsAvailabilityMismatch(capacityCandidates)
      } else {
        for (const listing of capacityCandidates) {
          const row = batch.results?.get?.(String(listing.id))
          if (!row) {
            filteredOutByAvailabilityErrors += 1
            console.error(
              `[SEARCH API] CRITICAL: batch availability returned no row for listing ${listing.id}; falling back to mismatch card.`,
            )
            if (allowSoftMismatch) listing._isAvailabilityMismatch = true
            availableListings.push(listing)
            continue
          }
          if (!row.available) {
            filteredOutByAvailability++
            bookedOutIds.add(listing.id)
            unresolvedUnavailableCandidates.push(listing)
            continue
          }
          listing._pricing = row.pricing || null
          availableListings.push(listing)
        }

        /**
         * Batch RPC can be overly pessimistic for some inventories.
         * Validate "unavailable" rows via canonical single-listing check.
         */
        if (unresolvedUnavailableCandidates.length > 0) {
          const rechecked = await Promise.all(
            unresolvedUnavailableCandidates.map(async (listing) => {
              try {
                const probe = await CalendarService.checkAvailability(listing.id, filters.checkIn, filters.checkOut, {
                  guestsCount,
                })
                return { listing, probe }
              } catch (error) {
                return { listing, probe: { success: false, available: false, error } }
              }
            }),
          )

          for (const { listing, probe } of rechecked) {
            if (probe?.success && probe.available === true) {
              if (bookedOutIds.has(listing.id)) {
                bookedOutIds.delete(listing.id)
                filteredOutByAvailability = Math.max(0, filteredOutByAvailability - 1)
              }
              listing._pricing = probe.pricing || listing._pricing || null
              availableListings.push(listing)
            }
          }
        }
      }
    } catch (err) {
      filteredOutByAvailabilityErrors += capacityCandidates.length
      console.error(
        '[SEARCH API] CRITICAL: batch availability threw; falling back to mismatch-tagged candidates.',
        err?.message || err,
      )
      // UX fail-open: keep visible cards with explicit mismatch flag.
      appendAsAvailabilityMismatch(capacityCandidates)
    }

    const SOFT_FILTER_MIN = 3
    if (allowSoftMismatch && availableListings.length < SOFT_FILTER_MIN && bookedOutIds.size > 0) {
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
