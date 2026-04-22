/**
 * @param {object | null} booking
 */
export function extractSettlementSnapshot(booking) {
  const snap = booking?.pricing_snapshot
  if (!snap || typeof snap !== 'object' || Array.isArray(snap)) return null
  const settlement = snap.settlement_v3
  if (!settlement || typeof settlement !== 'object') return null
  return settlement
}

/**
 * @template T, R
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T, index: number) => Promise<R>} mapper
 * @returns {Promise<R[]>}
 */
export async function mapWithConcurrency(items, limit, mapper) {
  if (!items?.length) return []
  const results = new Array(items.length)
  let index = 0
  async function worker() {
    for (;;) {
      const i = index++
      if (i >= items.length) break
      results[i] = await mapper(items[i], i)
    }
  }
  const pool = Math.min(Math.max(1, limit), items.length)
  await Promise.all(Array.from({ length: pool }, () => worker()))
  return results
}

export function normalizeDelayDays(raw, fallback) {
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.min(60, n)
}

export function normalizePayoutHour(raw, fallback) {
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0 || n > 23) return fallback
  return n
}
