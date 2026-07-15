/**
 * Partner seasonal price upsert SSOT (Stage 188.0).
 * Used by POST /api/v2/partner/seasonal-prices and POST /api/v2/partner/calendar/batch.
 */

import { parseISO, format, isBefore, isAfter, isSameDay, addDays, subDays } from 'date-fns'
import { revalidateListingPaths } from '@/lib/revalidation'

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
    `${SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}&owner_id=eq.${partnerId}&select=id,title`,
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
      price_daily: parseFloat(String(priceDaily)),
      price_monthly:
        priceMonthly != null && priceMonthly !== '' ? parseFloat(String(priceMonthly)) : null,
      season_type: seasonType || 'NORMAL',
      label: label || null,
      min_stay: minStay ? parseInt(String(minStay), 10) : 1,
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
    }
  } catch (error) {
    return {
      ok: false,
      listingId,
      listingTitle: resolvedTitle,
      error: error.message || 'Seasonal price upsert failed',
      code: 'UPSERT_ERROR',
    }
  }
}
