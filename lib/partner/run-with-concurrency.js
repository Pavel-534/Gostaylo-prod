/**
 * Run async tasks with a concurrency limit (Stage 188.0).
 * @template T, R
 * @param {{ items: T[], concurrency?: number, worker: (item: T, index: number) => Promise<R>, onProgress?: (completed: number, total: number, item: T) => void }} opts
 * @returns {Promise<Array<{ ok: true, value: R, item: T } | { ok: false, error: Error, item: T }>>}
 */
export async function runWithConcurrency({ items, concurrency = 3, worker, onProgress }) {
  const list = Array.isArray(items) ? items : []
  const total = list.length
  if (total === 0) return []

  const limit = Math.max(1, Math.min(concurrency, total))
  const results = new Array(total)
  let nextIndex = 0
  let completed = 0

  async function runWorker() {
    while (true) {
      const i = nextIndex
      nextIndex += 1
      if (i >= total) break
      const item = list[i]
      try {
        const value = await worker(item, i)
        results[i] = { ok: true, value, item }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        results[i] = { ok: false, error: err, item }
      }
      completed += 1
      onProgress?.(completed, total, item)
    }
  }

  await Promise.all(Array.from({ length: limit }, () => runWorker()))
  return results
}
