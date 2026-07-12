/**
 * Stage 178.9 — recent «Куда» destinations in localStorage (mobile search sheet).
 * Persisted on final «Найти» commit; max 4 unique values (MRU).
 */

export const RECENT_SEARCH_LOCATIONS_KEY = 'airento_recent_searches'
export const RECENT_SEARCH_LOCATIONS_MAX = 4
export const RECENT_SEARCH_LOCATIONS_UPDATED_EVENT = 'airento:recent-searches-updated'

/**
 * @typedef {{ value: string, label: string, ts: number }} RecentSearchLocation
 */

/**
 * @returns {RecentSearchLocation[]}
 */
export function readRecentSearchLocations() {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(RECENT_SEARCH_LOCATIONS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item) => item && typeof item.value === 'string' && item.value !== 'all')
      .map((item) => ({
        value: String(item.value),
        label: String(item.label || item.value),
        ts: Number(item.ts) || 0,
      }))
      .slice(0, RECENT_SEARCH_LOCATIONS_MAX)
  } catch {
    return []
  }
}

/**
 * @param {RecentSearchLocation[]} items
 */
function writeRecentSearchLocations(items) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(RECENT_SEARCH_LOCATIONS_KEY, JSON.stringify(items.slice(0, RECENT_SEARCH_LOCATIONS_MAX)))
    window.dispatchEvent(new CustomEvent(RECENT_SEARCH_LOCATIONS_UPDATED_EVENT))
  } catch {
    /* quota / private mode */
  }
}

/**
 * Push a destination to MRU list (dedupe by value, newest first).
 * @param {{ value: string, label?: string }} entry
 */
export function recordRecentSearchLocation(entry) {
  const value = String(entry?.value || '').trim()
  if (!value || value === 'all') return

  const label = String(entry?.label || value).trim() || value
  const prev = readRecentSearchLocations().filter((item) => item.value !== value)
  const next = [{ value, label, ts: Date.now() }, ...prev].slice(0, RECENT_SEARCH_LOCATIONS_MAX)
  writeRecentSearchLocations(next)
}

/**
 * @param {() => void} handler
 * @returns {() => void}
 */
export function subscribeRecentSearchLocations(handler) {
  if (typeof window === 'undefined') return () => {}
  const listener = () => handler()
  window.addEventListener(RECENT_SEARCH_LOCATIONS_UPDATED_EVENT, listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener(RECENT_SEARCH_LOCATIONS_UPDATED_EVENT, listener)
    window.removeEventListener('storage', listener)
  }
}
