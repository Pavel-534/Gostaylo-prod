/**
 * Bulk seasonal price apply — client concurrency + progress (Stage 188.0).
 */

import { runWithConcurrency } from '@/lib/partner/run-with-concurrency.js'
import { postPartnerCalendarBatch } from '@/lib/api/partner-calendar-batch-client.js'
import {
  showBulkSeasonalProgress,
  dismissBulkSeasonalProgress,
  showBulkSeasonalSummary,
  showSeasonalPriceSuccess,
  showSeasonalPriceError,
} from '@/lib/partner/partner-calendar-mutation-i18n.js'

async function upsertSeasonalPriceFetch({ partnerId, listingId, payload }) {
  const res = await fetch(
    `/api/v2/partner/seasonal-prices?partnerId=${encodeURIComponent(partnerId)}`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        listingId,
        startDate: payload.startDate,
        endDate: payload.endDate,
        priceDaily: payload.priceDaily,
        seasonType: payload.seasonType,
        label: payload.label,
        minStay: payload.minStay,
      }),
    },
  )
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.status === 'error') {
    const err = new Error(json.error || 'Failed to upsert seasonal price')
    err.listingId = listingId
    throw err
  }
  return json
}

/**
 * @param {{
 *   partnerId: string,
 *   listings: Array<{ listingId: string, listingTitle?: string }>,
 *   payload: { startDate: string, endDate: string, priceDaily: number, seasonType: string, label?: string|null, minStay: number },
 *   language?: string,
 *   strategy?: 'concurrent' | 'batch',
 * }} opts
 */
export async function applyBulkSeasonalPrices({
  partnerId,
  listings,
  payload,
  language = 'ru',
  strategy = 'concurrent',
}) {
  const items = Array.isArray(listings) ? listings : []
  const total = items.length
  if (!partnerId || total === 0) {
    return { total: 0, succeeded: 0, failed: 0, results: [] }
  }

  if (total === 1) {
    const item = items[0]
    try {
      const json = await upsertSeasonalPriceFetch({
        partnerId,
        listingId: item.listingId,
        payload,
      })
      showSeasonalPriceSuccess(language, json.meta?.conflictsResolved)
      return {
        total: 1,
        succeeded: 1,
        failed: 0,
        results: [{ ok: true, listingId: item.listingId, listingTitle: item.listingTitle }],
      }
    } catch (error) {
      showSeasonalPriceError(language, error.message)
      return {
        total: 1,
        succeeded: 0,
        failed: 1,
        results: [
          {
            ok: false,
            listingId: item.listingId,
            listingTitle: item.listingTitle,
            error: error.message,
          },
        ],
      }
    }
  }

  if (strategy === 'batch') {
    showBulkSeasonalProgress(language, 0, total)
    const operations = items.map((item) => ({
      type: 'seasonal_price',
      listingId: item.listingId,
      listingTitle: item.listingTitle,
      ...payload,
    }))
    const { data } = await postPartnerCalendarBatch({ operations })
    dismissBulkSeasonalProgress()
    const batch = data || { total, succeeded: 0, failed: total, results: [] }
    showBulkSeasonalSummary(
      {
        total: batch.total,
        succeeded: batch.succeeded,
        failed: batch.failed,
        results: batch.results,
      },
      language,
    )
    return batch
  }

  showBulkSeasonalProgress(language, 0, total)

  const results = await runWithConcurrency({
    items,
    concurrency: 3,
    worker: async (item) => {
      const json = await upsertSeasonalPriceFetch({
        partnerId,
        listingId: item.listingId,
        payload,
      })
      return {
        listingId: item.listingId,
        listingTitle: item.listingTitle,
        conflictsResolved: json.meta?.conflictsResolved,
      }
    },
    onProgress: (current, t) => {
      showBulkSeasonalProgress(language, current, t)
    },
  })

  const mapped = results.map((row) => {
    if (row.ok) {
      return {
        ok: true,
        listingId: row.value.listingId,
        listingTitle: row.value.listingTitle,
      }
    }
    const item = row.item
    return {
      ok: false,
      listingId: item?.listingId,
      listingTitle: item?.listingTitle,
      error: row.error?.message || 'Error',
    }
  })

  const succeeded = mapped.filter((r) => r.ok).length
  const failed = mapped.filter((r) => !r.ok).length
  const summary = { total, succeeded, failed, results: mapped }
  showBulkSeasonalSummary(summary, language)
  return summary
}
