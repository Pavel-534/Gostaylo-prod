/**
 * Partner calendar batch operations (Stage 188.0).
 * SSOT server-side batch apply with concurrency limit.
 */

import { runWithConcurrency } from '@/lib/partner/run-with-concurrency.js'
import { upsertPartnerSeasonalPrice } from '@/lib/services/calendar/partner-seasonal-price.service.js'

const BATCH_CONCURRENCY = 3

/**
 * @param {{ partnerId: string, operations: object[] }} params
 */
export async function applyPartnerCalendarBatch({ partnerId, operations }) {
  const ops = Array.isArray(operations) ? operations : []
  if (!partnerId) {
    return {
      ok: false,
      total: 0,
      succeeded: 0,
      failed: 0,
      results: [],
      error: 'partnerId required',
    }
  }

  if (ops.length === 0) {
    return { ok: true, total: 0, succeeded: 0, failed: 0, results: [] }
  }

  const seasonalOps = ops.filter((op) => op?.type === 'seasonal_price')
  const unsupported = ops.filter((op) => op?.type !== 'seasonal_price')

  const unsupportedResults = unsupported.map((op) => ({
    ok: false,
    type: op?.type || 'unknown',
    listingId: op?.listingId || null,
    listingTitle: op?.listingTitle || null,
    error: 'Unsupported batch operation type',
    code: 'UNSUPPORTED_OPERATION',
  }))

  const concurrencyResults = await runWithConcurrency({
    items: seasonalOps,
    concurrency: BATCH_CONCURRENCY,
    worker: async (op) =>
      upsertPartnerSeasonalPrice({
        partnerId,
        listingId: op.listingId,
        listingTitle: op.listingTitle,
        startDate: op.startDate,
        endDate: op.endDate,
        priceDaily: op.priceDaily,
        seasonType: op.seasonType,
        label: op.label ?? null,
        minStay: op.minStay,
      }),
  })

  const results = [
    ...unsupportedResults,
    ...concurrencyResults.map((row, index) => {
      const op = seasonalOps[index]
      if (row.ok && row.value?.ok) {
        return {
          ok: true,
          type: 'seasonal_price',
          listingId: row.value.listingId,
          listingTitle: row.value.listingTitle,
          conflictsResolved: row.value.conflictsResolved,
        }
      }
      const fail = row.ok ? row.value : null
      return {
        ok: false,
        type: 'seasonal_price',
        listingId: fail?.listingId || op?.listingId || null,
        listingTitle: fail?.listingTitle || op?.listingTitle || null,
        error: fail?.error || row.error?.message || 'Unknown error',
        code: fail?.code || 'BATCH_ITEM_FAILED',
      }
    }),
  ]

  const succeeded = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length
  const total = results.length

  return {
    ok: failed === 0,
    partial: succeeded > 0 && failed > 0,
    total,
    succeeded,
    failed,
    results,
  }
}
