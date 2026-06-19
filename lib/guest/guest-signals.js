/**
 * SSOT parse/serialize for guest viewed listings cookie (Stage 169.5).
 * Isomorphic — safe on server and client.
 */

import {
  GUEST_VIEWED_COOKIE_MAX_CHARS,
  GUEST_VIEWED_MAX_ITEMS,
  GUEST_VIEWED_PAYLOAD_VERSION,
  GUEST_VIEWED_TTL_MS,
} from '@/lib/guest/constants.js'

/**
 * @typedef {{ id: string, t: number }} GuestViewedItem
 */

/**
 * @param {unknown} items
 * @returns {GuestViewedItem[]}
 */
export function pruneGuestViewedItems(items, nowMs = Date.now()) {
  const cutoff = nowMs - GUEST_VIEWED_TTL_MS
  /** @type {Map<string, GuestViewedItem>} */
  const byId = new Map()

  for (const raw of items || []) {
    const id = String(raw?.id ?? '').trim()
    if (!id) continue
    const t = Number(raw?.t)
    const tsMs = Number.isFinite(t) ? (t > 1e12 ? t : t * 1000) : nowMs
    if (tsMs < cutoff) continue
    const sec = Math.floor(tsMs / 1000)
    const prev = byId.get(id)
    if (!prev || sec > prev.t) {
      byId.set(id, { id, t: sec })
    }
  }

  return [...byId.values()]
    .sort((a, b) => b.t - a.t)
    .slice(0, GUEST_VIEWED_MAX_ITEMS)
}

/**
 * @param {string | null | undefined} rawCookie
 * @returns {GuestViewedItem[]}
 */
export function parseGuestViewedCookie(rawCookie) {
  const raw = String(rawCookie ?? '').trim()
  if (!raw) return []

  try {
    const decoded = decodeURIComponent(raw)
    const parsed = JSON.parse(decoded)
    if (!parsed || typeof parsed !== 'object') return []
    if (parsed.v !== GUEST_VIEWED_PAYLOAD_VERSION) return []
    if (!Array.isArray(parsed.items)) return []
    return pruneGuestViewedItems(parsed.items)
  } catch {
    return []
  }
}

/**
 * @param {GuestViewedItem[]} items
 * @returns {string}
 */
export function serializeGuestViewedCookie(items) {
  let pruned = pruneGuestViewedItems(items)
  let payload = {
    v: GUEST_VIEWED_PAYLOAD_VERSION,
    items: pruned,
  }
  let encoded = encodeURIComponent(JSON.stringify(payload))

  while (encoded.length > GUEST_VIEWED_COOKIE_MAX_CHARS && pruned.length > 1) {
    pruned = pruned.slice(0, pruned.length - 1)
    payload = { v: GUEST_VIEWED_PAYLOAD_VERSION, items: pruned }
    encoded = encodeURIComponent(JSON.stringify(payload))
  }

  return encoded
}

/**
 * @param {GuestViewedItem[]} items
 * @returns {string[]}
 */
export function guestViewedListingIds(items) {
  return pruneGuestViewedItems(items).map((row) => row.id)
}

/**
 * @param {GuestViewedItem[]} items
 * @param {string} listingId
 * @param {number} [nowMs]
 * @returns {GuestViewedItem[]}
 */
export function upsertGuestViewedItem(items, listingId, nowMs = Date.now()) {
  const id = String(listingId || '').trim()
  if (!id) return pruneGuestViewedItems(items, nowMs)
  const t = Math.floor(nowMs / 1000)
  const next = [{ id, t }, ...(items || []).filter((row) => row.id !== id)]
  return pruneGuestViewedItems(next, nowMs)
}
