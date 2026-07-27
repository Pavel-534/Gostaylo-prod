/**
 * Stage 196.0-D — device-local offline cache for day-of CheckIn Access Pack (PII stays on device).
 */

const STORAGE_KEY = 'airento_access_pack_v1'
const MAX_ENTRIES = 12
const TTL_MS = 14 * 24 * 60 * 60 * 1000

function readStore() {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function writeStore(store) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    /* quota / private mode */
  }
}

function pruneStore(store, now = Date.now()) {
  const entries = Object.entries(store).filter(([, v]) => {
    const ts = Number(v?.savedAt)
    return Number.isFinite(ts) && now - ts < TTL_MS
  })
  entries.sort((a, b) => Number(b[1].savedAt) - Number(a[1].savedAt))
  return Object.fromEntries(entries.slice(0, MAX_ENTRIES))
}

function packHasContent(pack) {
  if (!pack || typeof pack !== 'object') return false
  return Boolean(
    String(pack.exactAddress || '').trim() ||
      String(pack.locationLabel || '').trim() ||
      String(pack.accessCode || '').trim() ||
      String(pack.instructionsText || '').trim() ||
      (Array.isArray(pack.photoUrls) && pack.photoUrls.length > 0) ||
      pack.chatHref,
  )
}

/**
 * Persist a visible access pack for weak-network day-of reopen.
 * @param {string} bookingId
 * @param {object} pack
 */
export function writeAccessPackOfflineCache(bookingId, pack) {
  const id = String(bookingId || '').trim()
  if (!id || !pack?.visible || !packHasContent(pack)) return false
  const store = pruneStore(readStore())
  store[id] = {
    savedAt: Date.now(),
    exactAddress: String(pack.exactAddress || ''),
    locationLabel: String(pack.locationLabel || ''),
    accessCode: String(pack.accessCode || ''),
    instructionsText: String(pack.instructionsText || ''),
    photoUrls: Array.isArray(pack.photoUrls) ? pack.photoUrls.filter(Boolean).slice(0, 6) : [],
    chatHref: pack.chatHref || null,
  }
  writeStore(pruneStore(store))
  return true
}

/**
 * @param {string} bookingId
 * @returns {object|null}
 */
export function readAccessPackOfflineCache(bookingId) {
  const id = String(bookingId || '').trim()
  if (!id) return null
  const row = pruneStore(readStore())[id]
  if (!row) return null
  return {
    visible: true,
    exactAddress: String(row.exactAddress || ''),
    locationLabel: String(row.locationLabel || ''),
    accessCode: String(row.accessCode || ''),
    instructionsText: String(row.instructionsText || ''),
    photoUrls: Array.isArray(row.photoUrls) ? row.photoUrls : [],
    chatHref: row.chatHref || null,
    fromOfflineCache: true,
  }
}

/**
 * Prefer live pack; fill empty fields from device cache (offline / flaky API).
 * @param {string} bookingId
 * @param {object} livePack
 */
export function mergeAccessPackWithOfflineCache(bookingId, livePack) {
  const live = livePack && typeof livePack === 'object' ? livePack : null
  const cached = readAccessPackOfflineCache(bookingId)
  if (!live?.visible) {
    const offline =
      typeof navigator !== 'undefined' && navigator && navigator.onLine === false
    if (offline && cached && packHasContent(cached)) return cached
    return live || { visible: false }
  }
  if (!cached) return { ...live, fromOfflineCache: false }
  const merged = {
    ...live,
    exactAddress: String(live.exactAddress || '').trim() || cached.exactAddress,
    locationLabel: String(live.locationLabel || '').trim() || cached.locationLabel,
    accessCode: String(live.accessCode || '').trim() || cached.accessCode,
    instructionsText: String(live.instructionsText || '').trim() || cached.instructionsText,
    photoUrls:
      Array.isArray(live.photoUrls) && live.photoUrls.length > 0 ? live.photoUrls : cached.photoUrls,
    chatHref: live.chatHref || cached.chatHref,
  }
  const usedCache =
    merged.exactAddress !== String(live.exactAddress || '').trim() ||
    merged.locationLabel !== String(live.locationLabel || '').trim() ||
    merged.accessCode !== String(live.accessCode || '').trim() ||
    merged.instructionsText !== String(live.instructionsText || '').trim() ||
    (merged.photoUrls || []).join('|') !== (live.photoUrls || []).join('|') ||
    merged.chatHref !== live.chatHref
  return { ...merged, fromOfflineCache: usedCache }
}
