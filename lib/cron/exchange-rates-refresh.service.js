/**
 * Stage 201.112 — FX cron refresh: skip if DB is fresh, never upsert empty on upstream failure.
 */

import { supabaseAdmin } from '@/lib/supabase'
import {
  DISPLAY_FX_CODES,
  EXCHANGE_RATES_CRON_MIN_INTERVAL_MS,
  fetchDisplayFxFromExchangeRateApiDetailed,
  upsertDisplayRatesInDb,
} from '@/lib/services/currency.service'

/**
 * Skip ExchangeRate-API when every display currency has a positive rate
 * and `updated_at` younger than the cron min interval.
 *
 * @param {Array<{ currency_code?: string, rate_to_thb?: unknown, updated_at?: string }>} rows
 * @param {number} [nowMs]
 * @param {number} [minIntervalMs]
 * @returns {boolean}
 */
export function shouldSkipExchangeRatesCronRefresh(
  rows,
  nowMs = Date.now(),
  minIntervalMs = EXCHANGE_RATES_CRON_MIN_INTERVAL_MS,
) {
  const byCode = {}
  for (const row of rows || []) {
    const code = String(row?.currency_code || '').trim().toUpperCase()
    const rate = Number(row?.rate_to_thb)
    const ts = row?.updated_at ? new Date(row.updated_at).getTime() : NaN
    if (!code) continue
    if (!Number.isFinite(rate) || rate <= 0) continue
    if (!Number.isFinite(ts)) continue
    byCode[code] = ts
  }
  for (const code of DISPLAY_FX_CODES) {
    const ts = byCode[code]
    if (!ts) return false
    if (nowMs - ts >= minIntervalMs) return false
  }
  return true
}

function newestUpdatedAt(rows) {
  let newest = null
  let newestTs = 0
  for (const row of rows || []) {
    if (!row?.updated_at) continue
    const ts = new Date(row.updated_at).getTime()
    if (!Number.isFinite(ts) || ts <= newestTs) continue
    newestTs = ts
    newest = row.updated_at
  }
  return newest
}

function httpStatusForUpstream(upstreamStatus) {
  if (upstreamStatus === 429) return 429
  return 502
}

/**
 * @returns {Promise<{
 *   success: boolean,
 *   httpStatus: number,
 *   skipped?: boolean,
 *   refreshed?: boolean,
 *   keptExisting?: boolean,
 *   message?: string,
 *   error?: string,
 *   ratesUpdatedAt?: string | null,
 *   upsertedCodes?: number,
 *   upstreamStatus?: number | null,
 * }>}
 */
export async function runExchangeRatesCronRefresh() {
  if (!supabaseAdmin) {
    return { success: false, httpStatus: 503, error: 'SERVICE_UNAVAILABLE' }
  }

  const { data: rows, error } = await supabaseAdmin
    .from('exchange_rates')
    .select('currency_code, rate_to_thb, updated_at')

  if (error) {
    return {
      success: false,
      httpStatus: 500,
      error: error.message,
      keptExisting: true,
    }
  }

  const ratesUpdatedAt = newestUpdatedAt(rows)
  if (shouldSkipExchangeRatesCronRefresh(rows)) {
    return {
      success: true,
      httpStatus: 200,
      skipped: true,
      message: 'Skipped, updated recently',
      ratesUpdatedAt,
    }
  }

  const fetched = await fetchDisplayFxFromExchangeRateApiDetailed()
  if (!fetched.ok || !fetched.map) {
    return {
      success: false,
      httpStatus: httpStatusForUpstream(fetched.httpStatus),
      skipped: false,
      keptExisting: true,
      message: 'Upstream FX failed; existing rates kept',
      error: fetched.error || 'UPSTREAM_FX_FAILED',
      upstreamStatus: fetched.httpStatus,
      ratesUpdatedAt,
    }
  }

  await upsertDisplayRatesInDb(fetched.map)
  return {
    success: true,
    httpStatus: 200,
    skipped: false,
    refreshed: true,
    upsertedCodes: Object.keys(fetched.map).length,
    ratesUpdatedAt: new Date().toISOString(),
  }
}
