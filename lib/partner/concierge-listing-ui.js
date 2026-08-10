/**
 * ADR-210 Slice 5 — Concierge listing detection for partner UI.
 */

/**
 * @param {{ import_platform?: string|null, importPlatform?: string|null, metadata?: object|null }} listing
 */
export function isConciergeImportListing(listing) {
  if (!listing || typeof listing !== 'object') return false
  const platform = String(listing.import_platform || listing.importPlatform || '')
    .trim()
    .toLowerCase()
  if (platform.startsWith('concierge')) return true
  const meta = listing.metadata
  if (meta && typeof meta === 'object') {
    if (meta.concierge_protected === true || meta.concierge_protected === 'true') return true
  }
  return false
}

/**
 * Concierge draft = Concierge origin + metadata.is_draft.
 * @param {{ import_platform?: string|null, importPlatform?: string|null, metadata?: object|null }} listing
 */
export function isConciergeDraftListing(listing) {
  if (!isConciergeImportListing(listing)) return false
  const md = listing.metadata || {}
  return md.is_draft === true || md.is_draft === 'true'
}

/**
 * @param {Array<object>|null|undefined} listings
 * @returns {number}
 */
export function countConciergeDraftListings(listings) {
  if (!Array.isArray(listings)) return 0
  return listings.filter(isConciergeDraftListing).length
}
