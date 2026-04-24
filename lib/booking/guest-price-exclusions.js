/**
 * Stage 30.0 — подсказки «что не включено в цену» (to-the-door) по категории и metadata листинга.
 */

import { isTransportListingCategory } from '@/lib/listing-category-slug'

function n(x) {
  const v = Number(x)
  return Number.isFinite(v) ? v : 0
}

/**
 * @param {string} categorySlug
 * @param {Record<string, unknown>} listingMetadata
 * @returns {{ key: string, amountThb?: number }[]}
 */
export function buildGuestPriceExclusionHints(categorySlug, listingMetadata) {
  const slug = String(categorySlug || '').toLowerCase()
  const meta =
    listingMetadata && typeof listingMetadata === 'object' && !Array.isArray(listingMetadata)
      ? listingMetadata
      : {}

  const lines = []

  if (isTransportListingCategory(slug) || slug === 'yachts') {
    const fp = String(meta.fuel_policy ?? meta.fuelPolicy ?? '')
      .toLowerCase()
      .replace(/-/g, '_')
    if (fp !== 'full_to_full') {
      lines.push({ key: 'orderExcluded_transportFuel' })
    }
  } else {
    const cleaning = n(meta.cleaning_fee_thb ?? meta.cleaning_fee ?? meta.cleaningFeeThb)
    const deposit = n(
      meta.security_deposit_thb ?? meta.deposit_thb ?? meta.damage_deposit_thb ?? meta.securityDepositThb,
    )
    if (cleaning > 0) {
      lines.push({ key: 'orderExcluded_stayCleaning', amountThb: cleaning })
    }
    if (deposit > 0) {
      lines.push({ key: 'orderExcluded_stayDeposit', amountThb: deposit })
    }
  }

  return lines
}
