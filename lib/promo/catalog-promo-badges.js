/**
 * Stage 33.0 — catalog/search: derive small promo badge from active `promo_codes` + duration tiers.
 */

import {
  parseDurationDiscountTiers,
  computeBestDurationDiscountPercent,
} from '@/lib/services/pricing.service'
import { normalizeAllowedListingIdsFromRow } from '@/lib/promo/allowed-listing-ids'

export { normalizeAllowedListingIdsFromRow } from '@/lib/promo/allowed-listing-ids'

/**
 * Promo applies to listing for catalog display (conservative: no site-wide PLATFORM spam).
 * @param {object} promo — row from promo_codes
 * @param {string} listingId
 * @param {string} ownerId
 */
export function promoAppliesToListingForCatalog(promo, listingId, ownerId) {
  const lid = String(listingId || '')
  const oid = String(ownerId || '')
  const allowed = normalizeAllowedListingIdsFromRow(promo.allowed_listing_ids)
  const ctype = String(promo.created_by_type || 'PLATFORM').toUpperCase()

  if (ctype === 'PARTNER') {
    const pid = String(promo.partner_id || '')
    if (!pid || pid !== oid) return false
    if (allowed && !allowed.includes(lid)) return false
    return true
  }

  if (ctype === 'PLATFORM') {
    if (!allowed?.length) return false
    return allowed.includes(lid)
  }

  return false
}

/**
 * @param {object} listing — raw or transformed (needs id, owner_id, metadata)
 * @param {object[]} promoRows — active promos
 * @param {number} nights — 0 if dates not in search
 * @returns {{ label: string, kind: 'promo'|'duration' } | null}
 */
export function computeCatalogPromoBadgeForListing(listing, promoRows, nights) {
  const lid = String(listing?.id || '')
  const ownerId = String(listing?.owner_id || listing?.ownerId || '')
  const meta = listing?.metadata && typeof listing.metadata === 'object' ? listing.metadata : {}
  const tiers = parseDurationDiscountTiers(meta.discounts)
  const durPct =
    nights >= 1 ? computeBestDurationDiscountPercent(nights, tiers) : 0

  let bestPromoPct = 0
  let bestPromoFixed = 0
  for (const p of promoRows || []) {
    if (!promoAppliesToListingForCatalog(p, lid, ownerId)) continue
    const t = String(p.promo_type || '').toUpperCase()
    if (t === 'PERCENTAGE') {
      const v = Number(p.value)
      if (Number.isFinite(v) && v > 0) bestPromoPct = Math.max(bestPromoPct, v)
    } else {
      const v = Number(p.value)
      if (Number.isFinite(v) && v > 0) bestPromoFixed = Math.max(bestPromoFixed, v)
    }
  }

  if (bestPromoPct > 0) return { label: `-${Math.round(bestPromoPct)}%`, kind: 'promo' }
  if (bestPromoFixed > 0) return { label: 'SALE', kind: 'promo' }
  if (durPct > 0) return { label: `-${Math.round(durPct)}%`, kind: 'duration' }
  if (tiers.length > 0) return { label: 'SALE', kind: 'duration' }
  return null
}

/**
 * Earliest still-valid flash-sale deadline among promos that apply to this listing.
 * @param {object} listing — raw or transformed (id, owner_id | ownerId)
 * @param {object[]} promoRows — active promos (same feed as {@link fetchActivePromoRowsForCatalog})
 * @returns {{ ends_at: string } | null} — `ends_at` ISO string for client countdown
 */
export function computeCatalogFlashUrgencyForListing(listing, promoRows) {
  const lid = String(listing?.id || '')
  const ownerId = String(listing?.owner_id || listing?.ownerId || '')
  let bestEnd = null
  for (const p of promoRows || []) {
    if (!p?.is_flash_sale) continue
    if (!p.valid_until) continue
    if (!promoAppliesToListingForCatalog(p, lid, ownerId)) continue
    const t = new Date(p.valid_until).getTime()
    if (Number.isNaN(t) || t <= Date.now()) continue
    if (bestEnd == null || t < bestEnd) bestEnd = t
  }
  if (bestEnd == null) return null
  return { ends_at: new Date(bestEnd).toISOString() }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient | null} client
 */
export async function fetchActivePromoRowsForCatalog(client) {
  if (!client) return []
  const { data, error } = await client
    .from('promo_codes')
    .select(
      'code, promo_type, value, created_by_type, partner_id, allowed_listing_ids, max_uses, current_uses, valid_until, is_active, is_flash_sale',
    )
    .eq('is_active', true)

  if (error || !Array.isArray(data)) return []

  const now = Date.now()
  return data.filter((row) => {
    if (row.valid_until && new Date(row.valid_until).getTime() < now) return false
    if (row.max_uses != null && Number(row.current_uses) >= Number(row.max_uses)) return false
    return true
  })
}

export function searchNightsBetween(checkInStr, checkOutStr) {
  if (!checkInStr || !checkOutStr) return 0
  const a = new Date(`${checkInStr}T12:00:00`)
  const b = new Date(`${checkOutStr}T12:00:00`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b <= a) return 0
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000))
}
