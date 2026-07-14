/**
 * Partner booking API responses — strip guest PII (P2P: contacts only via chat).
 * Stage 185.0 Phase 0.
 */

/**
 * @param {object | null | undefined} dto — output of transformPartnerBookingToClient (+ enrichments)
 * @returns {object | null | undefined}
 */
export function sanitizePartnerBookingForClient(dto) {
  if (!dto || typeof dto !== 'object') return dto

  const renter =
    dto.renter && typeof dto.renter === 'object'
      ? {
          id: dto.renter.id,
          firstName: dto.renter.firstName ?? dto.renter.first_name ?? null,
          lastName: dto.renter.lastName ?? dto.renter.last_name ?? null,
        }
      : null

  return {
    ...dto,
    guestPhone: null,
    guestEmail: null,
    renter,
  }
}

/**
 * @param {object[]} rows
 * @returns {object[]}
 */
export function sanitizePartnerBookingsForClient(rows) {
  if (!Array.isArray(rows)) return []
  return rows.map((row) => sanitizePartnerBookingForClient(row))
}
