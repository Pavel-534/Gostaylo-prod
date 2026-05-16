import { PLATFORM_SPLIT_FEE_DEFAULTS } from '@/lib/config/platform-split-fee-defaults.js'

/**
 * Per-night price shown on catalog cards (base + guest service fee), same as partner wizard site price in THB.
 * @param {number} basePriceThb
 * @param {number} [guestServiceFeePercent]
 * @returns {number}
 */
export function computeCatalogGuestDisplayPriceThb(basePriceThb, guestServiceFeePercent) {
  const base = Math.round(Math.max(0, Number(basePriceThb) || 0))
  const pct = Number(guestServiceFeePercent)
  const guestPct =
    Number.isFinite(pct) && pct >= 0 && pct <= 100
      ? pct
      : PLATFORM_SPLIT_FEE_DEFAULTS.guestServiceFeePercent
  const guestFeeThb = Math.round(base * (guestPct / 100))
  return base + guestFeeThb
}

/**
 * Price for catalog cards / map pins (prefer search API field, else recompute).
 * @param {Record<string, unknown> | null | undefined} listing
 * @param {number} [guestServiceFeePercent]
 */
export function resolveListingGuestDisplayPriceThb(listing, guestServiceFeePercent) {
  const fromApi = listing?.guestDisplayPriceThb ?? listing?.guest_display_price_thb
  const parsed = Number(fromApi)
  if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed)
  const base = Math.round(parseFloat(listing?.basePriceThb ?? listing?.base_price_thb ?? 0) || 0)
  if (base <= 0) return 0
  return computeCatalogGuestDisplayPriceThb(base, guestServiceFeePercent)
}
