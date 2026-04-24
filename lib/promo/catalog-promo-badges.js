/**
 * Stage 33.0 — catalog/search: derive small promo badge from active `promo_codes` + duration tiers.
 */

import {
  parseDurationDiscountTiers,
  computeBestDurationDiscountPercent,
} from '@/lib/services/pricing.service'
import { checkApplicabilityCached, promoIsActiveAt } from '@/lib/promo/promo-engine'
import { getBangkokLocalTodayUtcRange } from '@/lib/promo/flash-reminder-keys'

/**
 * Promo applies to listing for catalog display (conservative: no site-wide PLATFORM spam).
 * @param {object} promo — row from promo_codes
 * @param {string} listingId
 * @param {string} ownerId
 */
export function promoAppliesToListingForCatalog(promo, listingId, ownerId) {
  const a = checkApplicabilityCached(promo, {
    mode: 'catalog',
    listingId: listingId || null,
    listingOwnerId: ownerId || null,
    restrictPlatformGlobal: true,
  })
  return a.ok
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
 * Flash promo with earliest `valid_until` among those applicable in catalog (same pick for urgency + social proof).
 * @returns {object | null}
 */
export function pickEarliestApplicableFlashPromoForCatalog(listing, promoRows) {
  const lid = String(listing?.id || '')
  const ownerId = String(listing?.owner_id || listing?.ownerId || '')
  let bestPromo = null
  let bestEnd = null
  for (const p of promoRows || []) {
    if (!p?.is_flash_sale) continue
    if (!p.valid_until) continue
    if (!promoAppliesToListingForCatalog(p, lid, ownerId)) continue
    const t = new Date(p.valid_until).getTime()
    if (Number.isNaN(t) || t <= Date.now()) continue
    if (bestEnd == null || t < bestEnd) {
      bestEnd = t
      bestPromo = p
    }
  }
  return bestPromo
}

/**
 * Earliest still-valid flash-sale deadline among promos that apply to this listing.
 * @param {object} listing — raw or transformed (id, owner_id | ownerId)
 * @param {object[]} promoRows — active promos (same feed as {@link fetchActivePromoRowsForCatalog})
 * @returns {{ ends_at: string } | null} — `ends_at` ISO string for client countdown
 */
export function computeCatalogFlashUrgencyForListing(listing, promoRows) {
  const p = pickEarliestApplicableFlashPromoForCatalog(listing, promoRows)
  if (!p?.valid_until) return null
  const t = new Date(p.valid_until).getTime()
  if (Number.isNaN(t)) return null
  return { ends_at: new Date(t).toISOString() }
}

/**
 * Social proof for the same flash promo as urgency (Bangkok «today» booking count).
 * @param {Map<string, number>} countsByCodeToday — uppercased promo code → count
 * @returns {{ bookingsCreatedCount: number } | null}
 */
export function computeCatalogFlashSocialProofForListing(listing, promoRows, countsByCodeToday) {
  const p = pickEarliestApplicableFlashPromoForCatalog(listing, promoRows)
  if (!p) return null
  const code = String(p.code || '').trim().toUpperCase()
  if (!code || !countsByCodeToday) return null
  const n = Number(countsByCodeToday.get(code)) || 0
  if (n <= 0) return null
  return { bookingsCreatedCount: n }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient | null} client
 * @param {string[]} upperCodes
 * @returns {Promise<Map<string, number>>}
 */
export async function fetchBookingsCreatedTodayCountsByPromoCodes(client, upperCodes) {
  const map = new Map()
  if (!client || !upperCodes?.length) return map
  const uniq = [...new Set(upperCodes.map((c) => String(c || '').trim().toUpperCase()).filter(Boolean))]
  if (!uniq.length) return map
  const { startIso, endIso } = getBangkokLocalTodayUtcRange()
  const { data, error } = await client
    .from('bookings')
    .select('promo_code_used')
    .gte('created_at', startIso)
    .lt('created_at', endIso)
    .in('promo_code_used', uniq)
  if (error || !Array.isArray(data)) return map
  for (const row of data) {
    const code = String(row?.promo_code_used || '').trim().toUpperCase()
    if (!code) continue
    map.set(code, (map.get(code) || 0) + 1)
  }
  return map
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
  return data.filter((row) => promoIsActiveAt(row, now).ok)
}

export function searchNightsBetween(checkInStr, checkOutStr) {
  if (!checkInStr || !checkOutStr) return 0
  const a = new Date(`${checkInStr}T12:00:00`)
  const b = new Date(`${checkOutStr}T12:00:00`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b <= a) return 0
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000))
}
