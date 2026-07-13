/**
 * ADR-181.2 — server-side enforce `base_currency` after geo snapshot.
 * Call before `buildListingPriceWriteFields`.
 */

import { logStructured } from '@/lib/critical-telemetry.js'
import {
  isListingBaseCurrencyAutoEnabled,
  resolveEnforcedListingBaseCurrency,
} from '@/lib/listing/listing-asset-currency.js'

/**
 * @param {Record<string, unknown>} row — insertRow / updateData (mutated in place)
 * @param {{
 *   requestedCurrency?: string | null,
 *   existingCurrency?: string | null,
 *   listingId?: string | null,
 * }} [ctx]
 * @returns {{ baseCurrency: string, overridden: boolean, source: string }}
 */
export function applyListingBaseCurrencyInvariant(row, ctx = {}) {
  const geo = {
    countryCode: row.country_code ?? row.countryCode,
    regionCode: row.region_code ?? row.regionCode,
    cityCode: row.city_code ?? row.cityCode,
  }

  const requested = normalizeRequestedCurrency(
    ctx.requestedCurrency ?? row.base_currency ?? ctx.existingCurrency ?? 'THB',
  )

  const resolved = resolveEnforcedListingBaseCurrency({
    ...geo,
    requestedCurrency: requested,
  })

  if (!isListingBaseCurrencyAutoEnabled()) {
    if (resolved.overridden) {
      logStructured({
        event: 'listing_base_currency_auto_skipped',
        listingId: ctx.listingId || null,
        wouldEnforce: resolved.baseCurrency,
        requested,
        geo,
      })
    }
    row.base_currency = requested
    return { baseCurrency: requested, overridden: false, source: 'auto_disabled' }
  }

  if (resolved.overridden) {
    logStructured({
      event: 'listing_base_currency_overridden',
      listingId: ctx.listingId || null,
      from: requested,
      to: resolved.baseCurrency,
      source: resolved.source,
      geo,
    })
  }

  row.base_currency = resolved.baseCurrency
  return {
    baseCurrency: resolved.baseCurrency,
    overridden: resolved.overridden,
    source: resolved.source,
  }
}

function normalizeRequestedCurrency(raw) {
  const code = String(raw || 'THB').toUpperCase().trim()
  return code || 'THB'
}
