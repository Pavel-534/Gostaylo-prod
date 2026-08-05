/**
 * Partner seasonal price upsert SSOT (Stage 188.0 / 200.33 ADR-181 Wave 5.2).
 * Used by POST /api/v2/partner/seasonal-prices and POST /api/v2/partner/calendar/batch.
 *
 * UI sends priceDaily/priceMonthly in listing **asset** currency; DB stores THB ledger.
 */

import { parseISO, format, isBefore, isAfter, isSameDay, addDays, subDays } from 'date-fns'
import { revalidateListingPaths } from '@/lib/revalidation'
import { resolveSeasonalPriceCanonWithRates } from '@/lib/listing/listing-seasonal-price-canon'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function supabaseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    ...extra,
  }
}

/**
 * @param {string} listingId
 * @param {string} newStart
 * @param {string} newEnd
 */
export async function resolveSeasonalPriceConflicts(listingId, newStart, newEnd) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase not configured')
  }

  const newStartDate = parseISO(newStart)
  const newEndDate = parseISO(newEnd)

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/seasonal_prices?listing_id=eq.${listingId}&or=(and(start_date.lte.${newEnd},end_date.gte.${newStart}))&select=*`,
    { headers: supabaseHeaders() },
  )

  const overlapping = await res.json()
  if (!Array.isArray(overlapping) || overlapping.length === 0) {
    return { toDelete: [], toUpdate: [] }
  }

  const toDelete = []
  const toUpdate = []

  for (const existing of overlapping) {
    const existingStart = parseISO(existing.start_date)
    const existingEnd = parseISO(existing.end_date)

    if (
      (isSameDay(newStartDate, existingStart) || isBefore(newStartDate, existingStart)) &&
      (isSameDay(newEndDate, existingEnd) || isAfter(newEndDate, existingEnd))
    ) {
      toDelete.push(existing.id)
    } else if (isBefore(existingStart, newStartDate) && isAfter(existingEnd, newEndDate)) {
      toUpdate.push({
        id: existing.id,
        start_date: format(existingStart, 'yyyy-MM-dd'),
        end_date: format(subDays(newStartDate, 1), 'yyyy-MM-dd'),
      })
    } else if (
      isBefore(existingStart, newStartDate) &&
      isAfter(existingEnd, newStartDate) &&
      !isAfter(existingEnd, newEndDate)
    ) {
      toUpdate.push({
        id: existing.id,
        start_date: format(existingStart, 'yyyy-MM-dd'),
        end_date: format(subDays(newStartDate, 1), 'yyyy-MM-dd'),
      })
    } else if (
      isBefore(newStartDate, existingStart) &&
      isBefore(existingStart, newEndDate) &&
      isAfter(existingEnd, newEndDate)
    ) {
      toUpdate.push({
        id: existing.id,
        start_date: format(addDays(newEndDate, 1), 'yyyy-MM-dd'),
        end_date: format(existingEnd, 'yyyy-MM-dd'),
      })
    }
  }

  return { toDelete, toUpdate }
}

/**
 * @param {{
 *   partnerId: string,
 *   listingId: string,
 *   startDate: string,
 *   endDate: string,
 *   priceDaily: number | string,
 *   priceMonthly?: number | string | null,
 *   seasonType?: string,
 *   label?: string | null,
 *   minStay?: number | string,
 *   listingTitle?: string,
 *   currency?: string | null,
 * }} input
 */
export async function upsertPartnerSeasonalPrice(input) {
  const {
    partnerId,
    listingId,
    startDate,
    endDate,
    priceDaily,
    priceMonthly,
    seasonType,
    label,
    minStay,
    listingTitle,
    currency: currencyOverride,
  } = input

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return {
      ok: false,
      listingId,
      listingTitle: listingTitle || null,
      error: 'Supabase not configured',
      code: 'SUPABASE_NOT_CONFIGURED',
    }
  }

  if (!listingId || !startDate || !endDate || priceDaily == null || priceDaily === '') {
    return {
      ok: false,
      listingId,
      listingTitle: listingTitle || null,
      error: 'Missing required fields',
      code: 'VALIDATION_ERROR',
    }
  }

  const listingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}&owner_id=eq.${partnerId}&select=id,title,base_currency`,
    { headers: supabaseHeaders() },
  )
  const listingRows = await listingRes.json()
  if (!Array.isArray(listingRows) || listingRows.length === 0) {
    return {
      ok: false,
      listingId,
      listingTitle: listingTitle || null,
      error: 'Listing not found or access denied',
      code: 'LISTING_NOT_FOUND',
    }
  }

  const resolvedTitle = listingTitle || listingRows[0]?.title || null
  const listingCurrency = String(currencyOverride || listingRows[0]?.base_currency || 'THB')
    .toUpperCase()
    .slice(0, 8)

  let canon
  try {
    canon = await resolveSeasonalPriceCanonWithRates({
      priceDailyAsset: priceDaily,
      priceMonthlyAsset: priceMonthly,
      currency: listingCurrency,
    })
  } catch (err) {
    return {
      ok: false,
      listingId,
      listingTitle: resolvedTitle,
      error: err?.message || 'Seasonal price conversion failed',
      code: err?.code || 'SEASONAL_PRICE_CANON_FAILED',
    }
  }

  try {
    const { toDelete, toUpdate } = await resolveSeasonalPriceConflicts(listingId, startDate, endDate)

    for (const id of toDelete) {
      await fetch(`${SUPABASE_URL}/rest/v1/seasonal_prices?id=eq.${id}`, {
        method: 'DELETE',
        headers: supabaseHeaders(),
      })
    }

    for (const update of toUpdate) {
      await fetch(`${SUPABASE_URL}/rest/v1/seasonal_prices?id=eq.${update.id}`, {
        method: 'PATCH',
        headers: supabaseHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
        body: JSON.stringify({
          start_date: update.start_date,
          end_date: update.end_date,
        }),
      })
    }

    const newPrice = {
      listing_id: listingId,
      start_date: startDate,
      end_date: endDate,
      price_daily: canon.priceDailyThb,
      price_monthly: canon.priceMonthlyThb,
      season_type: seasonType || 'NORMAL',
      label: label || null,
      min_stay: minStay ? parseInt(String(minStay), 10) : 1,
      metadata: canon.metadata && Object.keys(canon.metadata).length ? canon.metadata : {},
    }

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/seasonal_prices`, {
      method: 'POST',
      headers: supabaseHeaders({
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      }),
      body: JSON.stringify(newPrice),
    })

    if (!insertRes.ok) {
      const errorBody = await insertRes.json().catch(() => ({}))
      const msg = String(errorBody.message || errorBody.error || '').toLowerCase()
      if (msg.includes('metadata') || insertRes.status === 400) {
        const { metadata: _m, ...withoutMeta } = newPrice
        const retry = await fetch(`${SUPABASE_URL}/rest/v1/seasonal_prices`, {
          method: 'POST',
          headers: supabaseHeaders({
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          }),
          body: JSON.stringify(withoutMeta),
        })
        if (!retry.ok) {
          const retryBody = await retry.json().catch(() => ({}))
          return {
            ok: false,
            listingId,
            listingTitle: resolvedTitle,
            error:
              retryBody.message ||
              retryBody.error ||
              errorBody.message ||
              'Failed to insert seasonal price',
            code: 'INSERT_FAILED',
          }
        }
        const insertedRetry = await retry.json()
        try {
          await revalidateListingPaths('update', listingId)
        } catch (e) {
          console.warn('[partner-seasonal-price] revalidate:', e?.message)
        }
        return {
          ok: true,
          listingId,
          listingTitle: resolvedTitle,
          data: insertedRetry[0] || insertedRetry,
          conflictsResolved: { deleted: toDelete.length, updated: toUpdate.length },
          metadataPersisted: false,
        }
      }
      return {
        ok: false,
        listingId,
        listingTitle: resolvedTitle,
        error: errorBody.message || errorBody.error || 'Failed to insert seasonal price',
        code: 'INSERT_FAILED',
      }
    }

    const inserted = await insertRes.json()

    try {
      await revalidateListingPaths('update', listingId)
    } catch (e) {
      console.warn('[partner-seasonal-price] revalidate:', e?.message)
    }

    return {
      ok: true,
      listingId,
      listingTitle: resolvedTitle,
      data: inserted[0] || inserted,
      conflictsResolved: { deleted: toDelete.length, updated: toUpdate.length },
      metadataPersisted: true,
    }
  } catch (error) {
    return {
      ok: false,
      listingId,
      listingTitle: resolvedTitle,
      error: error?.message || 'Seasonal upsert failed',
      code: 'UPSERT_EXCEPTION',
    }
  }
}
