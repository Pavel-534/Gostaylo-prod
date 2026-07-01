/**
 * Stage 177.2c — cursor page refill when availability post-filter yields sparse pages.
 */

import {
  applyDiscoveryAvailabilityToPage,
  discoveryPlanHasAvailabilityStep,
} from '@/lib/search/discovery-availability-page'
import {
  buildDiscoveryCursorFromListingRow,
  slicePageAndBuildNextCursor,
} from '@/lib/search/discovery-cursor-page'

/** @typedef {import('@/lib/search/filter-registry').DiscoveryQueryPlan} DiscoveryQueryPlan */

export const DEFAULT_DISCOVERY_CURSOR_REFILL_MAX = 5

/**
 * @returns {number}
 */
export function getDiscoveryCursorRefillMax() {
  const raw = process.env.DISCOVERY_CURSOR_REFILL_MAX
  if (raw == null || String(raw).trim() === '') {
    return DEFAULT_DISCOVERY_CURSOR_REFILL_MAX
  }
  const n = parseInt(String(raw).trim(), 10)
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_DISCOVERY_CURSOR_REFILL_MAX
}

/**
 * @param {DiscoveryQueryPlan|null|undefined} plan
 * @returns {boolean}
 */
export function discoveryPlanNeedsCursorRefill(plan) {
  return plan?.sql?.paginationMode === 'cursor' && discoveryPlanHasAvailabilityStep(plan)
}

/**
 * @param {object[]} acceptedRows
 * @param {boolean} sqlHasMore
 * @param {number} pageSize
 * @param {number} refillAttempts
 * @returns {{
 *   acceptedRows: object[],
 *   nextCursor: string|null,
 *   hasMore: boolean,
 *   refillAttempts: number,
 * }}
 */
function buildCursorRefillResult(acceptedRows, sqlHasMore, pageSize, refillAttempts) {
  const accepted = Array.isArray(acceptedRows) ? acceptedRows : []
  const capped = accepted.length > pageSize ? accepted.slice(0, pageSize) : accepted
  const hasMore = Boolean(sqlHasMore)
  const lastAccepted = capped.length > 0 ? capped[capped.length - 1] : null
  const nextCursor = hasMore && lastAccepted ? buildDiscoveryCursorFromListingRow(lastAccepted) : null

  if (hasMore && capped.length === 0) {
    void import('@/lib/critical-telemetry')
      .then(({ recordCriticalSignal }) => {
        recordCriticalSignal('discovery_cursor_starvation', {
          refillAttempts,
          pageSize,
        })
      })
      .catch((err) => {
        console.error('[discovery] cursor starvation telemetry failed', err?.message || err)
      })
  }

  return {
    acceptedRows: capped,
    nextCursor,
    hasMore,
    refillAttempts,
  }
}

/**
 * When cursor pagination + stay dates yield fewer than `pageSize` accepted rows while SQL
 * still has more keyset pages, fetch additional SQL pages up to `MAX_REFILL`.
 *
 * `next_cursor` is always derived from the last **accepted** row (never the last probed SQL row).
 *
 * @param {object[]} acceptedRows
 * @param {object[]} rawRows — first SQL page (diagnostic; already processed into acceptedRows)
 * @param {DiscoveryQueryPlan} plan
 * @param {(internalCursor: string|null) => Promise<{ data: object[]|null, error?: object|null }>} executeNextPageCb
 * @param {{
 *   sqlHasMore: boolean,
 *   sqlNextCursor: string|null,
 *   pageSize?: number,
 *   maxRefill?: number,
 * }} ctx
 */
export async function discoveryCursorRefillIfSparse(
  acceptedRows,
  rawRows,
  plan,
  executeNextPageCb,
  ctx,
) {
  void rawRows

  const pageSize = Math.max(1, Math.floor(Number(ctx.pageSize ?? plan.sql?.pageSize) || 24))
  const maxRefill = ctx.maxRefill ?? getDiscoveryCursorRefillMax()

  let accepted = Array.isArray(acceptedRows) ? [...acceptedRows] : []
  if (accepted.length > pageSize) {
    accepted = accepted.slice(0, pageSize)
  }

  let sqlHasMore = Boolean(ctx.sqlHasMore)
  let internalCursor = ctx.sqlNextCursor ?? null
  let refillAttempts = 0

  if (!discoveryPlanNeedsCursorRefill(plan)) {
    return buildCursorRefillResult(accepted, sqlHasMore, pageSize, refillAttempts)
  }

  if (accepted.length >= pageSize || !sqlHasMore) {
    return buildCursorRefillResult(accepted, sqlHasMore, pageSize, refillAttempts)
  }

  while (accepted.length < pageSize && sqlHasMore && refillAttempts < maxRefill) {
    refillAttempts += 1

    const nextFetch = await executeNextPageCb(internalCursor)
    if (nextFetch?.error) {
      break
    }

    const sliced = slicePageAndBuildNextCursor(nextFetch.data, pageSize)
    internalCursor = sliced.nextCursor
    sqlHasMore = sliced.hasMore

    if (!sliced.pageRows.length) {
      sqlHasMore = false
      break
    }

    const { rows } = await applyDiscoveryAvailabilityToPage(sliced.pageRows, plan)
    for (const row of rows) {
      if (accepted.length >= pageSize) break
      accepted.push(row)
    }
  }

  return buildCursorRefillResult(accepted, sqlHasMore, pageSize, refillAttempts)
}
