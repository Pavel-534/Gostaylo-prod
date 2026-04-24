/**
 * Alpha: copy host-facing pickup / access copy from listing metadata into booking.metadata.
 */

/**
 * @param {object | null | undefined} listing — DB listing row with `metadata`
 * @returns {Record<string, string>}
 */
export function pickCheckInInstructionsForBookingMetadata(listing) {
  const meta =
    listing?.metadata && typeof listing.metadata === 'object' && !Array.isArray(listing.metadata)
      ? listing.metadata
      : {}
  const raw = meta.check_in_instructions
  if (typeof raw !== 'string') return {}
  const s = raw.trim()
  if (!s) return {}
  return { check_in_instructions: s }
}
