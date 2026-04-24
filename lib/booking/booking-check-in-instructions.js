/**
 * Копирует из `listings.metadata` в `bookings.metadata`: текст и до 3 URL фото инструкции (Stage 31.0).
 */

/** @param {unknown} raw */
function normalizeCheckInPhotoUrls(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((u) => (typeof u === 'string' ? u.trim() : ''))
    .filter((u) => /^https?:\/\//i.test(u))
    .slice(0, 3)
}

/**
 * @param {object | null | undefined} listing — DB listing row with `metadata`
 * @returns {Record<string, unknown>}
 */
export function pickCheckInInstructionsForBookingMetadata(listing) {
  const meta =
    listing?.metadata && typeof listing.metadata === 'object' && !Array.isArray(listing.metadata)
      ? listing.metadata
      : {}
  const out = {}
  const raw = meta.check_in_instructions
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (s) out.check_in_instructions = s
  }
  const photos = normalizeCheckInPhotoUrls(meta.check_in_photos)
  if (photos.length) out.check_in_photos = photos
  return out
}
