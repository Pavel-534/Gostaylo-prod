/**
 * Detect client soft-nav / chunk failures that need a hard reload (Stage 201.15).
 * Stage 202.43 — covers webpack `Loading chunk … (timeout)` via airento.ru proxy.
 * @param {unknown} error
 * @returns {boolean}
 */
export function isClientNavFailure(error) {
  const name = String(error?.name || '')
  const message = String(error?.message || '')
  const digest = String(error?.digest || '')
  const blob = `${name}\n${message}\n${digest}`
  return /ChunkLoadError|Loading chunk|CSS chunk|Failed to fetch|dynamically imported module|Load failed|Importing a module script failed/i.test(
    blob,
  )
}
