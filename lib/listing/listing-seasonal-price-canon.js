/**
 * Stage 200.33 / ADR-181 Wave 5.2 — seasonal prices: partner enters L1 asset currency;
 * `seasonal_prices.price_daily` / `price_monthly` remain THB ledger for PricingService.
 */

import {
  isListingAssetPriceCanonEnabled,
  resolveListingBasePriceCanon,
  resolveListingBasePriceCanonWithRates,
} from '@/lib/listing/listing-base-price-canon'

const ASSET_META_KEY = 'price_daily_asset'
const ASSET_MONTHLY_KEY = 'price_monthly_asset'

/** Canonical season_type values for partner UI Selects (Stage 200.116). */
export const SEASON_TYPE_VALUES = Object.freeze(['LOW', 'NORMAL', 'HIGH', 'PEAK'])

/**
 * Normalize legacy / mixed-case season_type to Select-safe uppercase enum.
 * Unknown values fall back to NORMAL (not blank SelectValue).
 * @param {unknown} raw
 * @returns {'LOW'|'NORMAL'|'HIGH'|'PEAK'}
 */
export function normalizeSeasonType(raw) {
  const key = String(raw ?? '')
    .trim()
    .toUpperCase()
  if (SEASON_TYPE_VALUES.includes(key)) return /** @type {'LOW'|'NORMAL'|'HIGH'|'PEAK'} */ (key)
  return 'NORMAL'
}

/**
 * @param {unknown} raw
 * @returns {object}
 */
export function parseSeasonalRowMetadata(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return { ...raw }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
    } catch {
      /* ignore */
    }
  }
  return {}
}

/**
 * @param {object | null | undefined} asset
 * @returns {{ amount: number, currency: string, rate_thb_per_unit_mid: number, converted_at: string } | null}
 */
function normalizeAssetSnapshot(asset) {
  if (!asset || typeof asset !== 'object') return null
  const amount = Number(asset.amount)
  if (!Number.isFinite(amount) || amount < 0) return null
  const currency = String(asset.currency || 'THB').toUpperCase()
  const rate = Number(asset.rate_thb_per_unit_mid)
  return {
    amount: Math.round(amount * 100) / 100,
    currency,
    rate_thb_per_unit_mid: Number.isFinite(rate) && rate > 0 ? rate : currency === 'THB' ? 1 : rate,
    converted_at: typeof asset.converted_at === 'string' ? asset.converted_at : '',
  }
}

/**
 * Read L1 amounts for partner UI (prefer metadata snapshot).
 * @param {object} row — DB seasonal_prices row or API camelCase
 * @returns {{ priceDaily: number, priceMonthly: number | null, hasAsset: boolean, currency: string | null }}
 */
export function readSeasonalAssetAmountsFromRow(row = {}) {
  const meta = parseSeasonalRowMetadata(row.metadata ?? row.Metadata)
  const dailyAsset = normalizeAssetSnapshot(meta[ASSET_META_KEY] || meta.priceDailyAsset)
  const monthlyAsset = normalizeAssetSnapshot(meta[ASSET_MONTHLY_KEY] || meta.priceMonthlyAsset)

  const ledgerDaily = Number(row.price_daily ?? row.priceDaily)
  const ledgerMonthlyRaw = row.price_monthly ?? row.priceMonthly
  const ledgerMonthly =
    ledgerMonthlyRaw != null && ledgerMonthlyRaw !== '' ? Number(ledgerMonthlyRaw) : null

  if (dailyAsset) {
    return {
      priceDaily: dailyAsset.amount,
      priceMonthly: monthlyAsset ? monthlyAsset.amount : null,
      hasAsset: true,
      currency: dailyAsset.currency,
    }
  }

  return {
    priceDaily: Number.isFinite(ledgerDaily) ? ledgerDaily : 0,
    priceMonthly: Number.isFinite(ledgerMonthly) ? ledgerMonthly : null,
    hasAsset: false,
    currency: null,
  }
}

/**
 * @param {{
 *   priceDailyAsset: number
 *   priceMonthlyAsset?: number | null
 *   currency?: string
 *   rateMap?: Record<string, number>
 *   convertedAt?: string
 * }} params
 */
export function resolveSeasonalPriceCanon({
  priceDailyAsset,
  priceMonthlyAsset = null,
  currency = 'THB',
  rateMap = {},
  convertedAt,
}) {
  const daily = resolveListingBasePriceCanon({
    amount: priceDailyAsset,
    currency,
    rateMap,
    convertedAt,
  })

  let monthly = null
  if (priceMonthlyAsset != null && priceMonthlyAsset !== '' && Number(priceMonthlyAsset) > 0) {
    monthly = resolveListingBasePriceCanon({
      amount: priceMonthlyAsset,
      currency,
      rateMap,
      convertedAt: daily.basePriceAsset.converted_at,
    })
  }

  return {
    priceDailyThb: daily.basePriceThb,
    priceMonthlyThb: monthly ? monthly.basePriceThb : null,
    metadata: {
      [ASSET_META_KEY]: daily.basePriceAsset,
      ...(monthly ? { [ASSET_MONTHLY_KEY]: monthly.basePriceAsset } : {}),
    },
  }
}

/**
 * @param {{ priceDailyAsset: number, priceMonthlyAsset?: number|null, currency?: string }} params
 */
export async function resolveSeasonalPriceCanonWithRates(params) {
  if (!isListingAssetPriceCanonEnabled()) {
    const daily = Math.round(Number(params.priceDailyAsset) || 0)
    const monthlyRaw = params.priceMonthlyAsset
    const monthly =
      monthlyRaw != null && monthlyRaw !== '' && Number(monthlyRaw) > 0
        ? Math.round(Number(monthlyRaw))
        : null
    return {
      priceDailyThb: daily,
      priceMonthlyThb: monthly,
      metadata: {},
    }
  }

  const { getRawRateMap } = await import('@/lib/services/pricing/pricing-fx-helpers.js')
  const rateMap = await getRawRateMap()
  return resolveSeasonalPriceCanon({ ...params, rateMap })
}

/**
 * Partner/wizard API shape — L1 amounts for edit UI.
 * @param {object} sp — DB row
 */
export function mapSeasonalRowForPartnerUi(sp) {
  const amounts = readSeasonalAssetAmountsFromRow(sp)
  return {
    id: sp.id,
    label: sp.label,
    startDate: sp.start_date ?? sp.startDate,
    endDate: sp.end_date ?? sp.endDate,
    priceDaily: amounts.priceDaily,
    priceMonthly: amounts.priceMonthly,
    seasonType: normalizeSeasonType(sp.season_type ?? sp.seasonType),
    minStay: sp.min_stay ?? sp.minStay ?? 1,
    description:
      typeof sp.description === 'string' && !String(sp.description).trim().startsWith('{')
        ? sp.description
        : null,
    /** Ledger (for diagnostics / calendar cells that already have THB) */
    priceDailyThb: parseFloat(sp.price_daily ?? sp.priceDaily) || 0,
    priceMonthlyThb:
      sp.price_monthly != null || sp.priceMonthly != null
        ? parseFloat(sp.price_monthly ?? sp.priceMonthly) || null
        : null,
    hasAssetSnapshot: amounts.hasAsset,
    assetCurrency: amounts.currency,
  }
}

export { ASSET_META_KEY, ASSET_MONTHLY_KEY }
