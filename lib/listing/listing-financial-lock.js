/**
 * ADR-181.4 — financial lock: base_currency + base price while active bookings exist.
 * @see docs/ADR/181-listing-asset-currency-ssot.md §Wave 4
 */

import { logStructured } from '@/lib/critical-telemetry.js'
import {
  LISTING_FINANCIAL_LOCK_BLOCKING_STATUSES,
  listingFinancialLockStatusesInFilter,
} from '@/lib/booking/status-sets.js'
import { readPartnerFormAssetAmount } from '@/lib/listing/listing-base-price-canon.js'
import { resolveEnforcedListingBaseCurrency } from '@/lib/listing/listing-asset-currency.js'
import { applyListingGeoSnapshotToUpdateData } from '@/lib/partner/apply-listing-geo-snapshot'

export const LISTING_ASSET_LOCKED_ACTIVE_BOOKINGS = 'LISTING_ASSET_LOCKED_ACTIVE_BOOKINGS'

const PRICE_EPSILON = 0.005

/** Opt-out: `LISTING_BASE_CURRENCY_LOCK=0` */
export function isListingFinancialLockEnabled() {
  return String(process.env.LISTING_BASE_CURRENCY_LOCK ?? '1').trim() !== '0'
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase — service role
 * @param {string} listingId
 * @returns {Promise<{ locked: boolean, activeBookingCount: number, lockDisabled?: boolean }>}
 */
export async function checkListingFinancialLock(supabase, listingId) {
  if (!isListingFinancialLockEnabled()) {
    return { locked: false, activeBookingCount: 0, lockDisabled: true }
  }

  const { count, error } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('listing_id', listingId)
    .in('status', LISTING_FINANCIAL_LOCK_BLOCKING_STATUSES)

  if (error) {
    const err = new Error('Failed to verify listing financial lock')
    err.code = 'LISTING_FINANCIAL_LOCK_CHECK_FAILED'
    throw err
  }

  const activeBookingCount = count ?? 0
  return {
    locked: activeBookingCount > 0,
    activeBookingCount,
  }
}

/**
 * Dry-run: would this PATCH materially change listing financial fields?
 *
 * @param {{ existing: object, body: object }} params
 */
export function detectAttemptedListingFinancialChange({ existing, body }) {
  const changes = {
    currency: false,
    basePrice: false,
    geoMayRecalcPrice: false,
  }

  const existingCurrency = String(existing.base_currency || 'THB').toUpperCase()
  const existingAssetAmount = readPartnerFormAssetAmount(existing)

  const requestedCurrency =
    body.baseCurrency !== undefined || body.base_currency !== undefined
      ? String(body.baseCurrency ?? body.base_currency).toUpperCase()
      : null

  if (requestedCurrency && requestedCurrency !== existingCurrency) {
    changes.currency = true
  }

  const geoTouched =
    body.country != null || body.region != null || body.city != null

  if (geoTouched) {
    const { updateData: geoDraft } = applyListingGeoSnapshotToUpdateData({}, body, existing)
    const enforced = resolveEnforcedListingBaseCurrency({
      countryCode: geoDraft.country_code ?? existing.country_code,
      regionCode: geoDraft.region_code ?? existing.region_code,
      cityCode: geoDraft.city_code ?? existing.city_code,
      requestedCurrency: requestedCurrency ?? existingCurrency,
    })
    if (enforced.baseCurrency !== existingCurrency) {
      changes.currency = true
      changes.geoMayRecalcPrice = true
    }
  }

  if (body.basePriceThb !== undefined) {
    const nextAmount = Number(body.basePriceThb)
    const prevAmount = existingAssetAmount ?? Number(existing.base_price_thb) ?? 0
    if (
      Number.isFinite(nextAmount) &&
      Math.abs(nextAmount - prevAmount) > PRICE_EPSILON
    ) {
      changes.basePrice = true
    }
  } else if (changes.currency) {
    changes.basePrice = true
  }

  return {
    attempted: changes.currency || changes.basePrice,
    changes,
    existingCurrency,
    existingAssetAmount,
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} listingId
 * @param {{ existing: object, body: object, partnerId?: string | null }} ctx
 */
export async function assertListingFinancialEditAllowed(supabase, listingId, ctx) {
  const attempt = detectAttemptedListingFinancialChange(ctx)
  if (!attempt.attempted) {
    return { allowed: true, attempt }
  }

  if (!isListingFinancialLockEnabled()) {
    logStructured({
      event: 'listing_financial_lock_skipped',
      listingId,
      partnerId: ctx.partnerId ?? null,
      attemptedChanges: attempt.changes,
    })
    return { allowed: true, attempt, lockDisabled: true }
  }

  const lock = await checkListingFinancialLock(supabase, listingId)
  if (!lock.locked) {
    return { allowed: true, attempt, lock }
  }

  logStructured({
    event: 'listing_financial_lock_rejected',
    listingId,
    partnerId: ctx.partnerId ?? null,
    activeBookingCount: lock.activeBookingCount,
    blockingStatuses: listingFinancialLockStatusesInFilter(),
    attemptedChanges: attempt.changes,
    code: LISTING_ASSET_LOCKED_ACTIVE_BOOKINGS,
  })

  const err = new Error(
    'Cannot change listing currency or base price while active bookings exist.',
  )
  err.code = LISTING_ASSET_LOCKED_ACTIVE_BOOKINGS
  err.status = 400
  err.details = {
    activeBookingCount: lock.activeBookingCount,
    attemptedChanges: attempt.changes,
  }
  throw err
}
