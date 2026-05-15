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
