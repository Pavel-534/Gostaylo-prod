/**
 * Stage M1.1 — client FCM storage keys + logout cleanup helpers.
 * Legacy `gostaylo_*` prefix kept as internal id (not product brand).
 */

export const PUSH_FCM_TOKEN_KEY = 'gostaylo_fcm_token'
export const PUSH_REGISTERED_UID_KEY = 'gostaylo_push_registered_uid'

/** Soft CTA / Settings → PushClientInit should (re)sync after gesture grant. */
export const PUSH_ENABLE_EVENT = 'gostaylo:push-enable'

/** Stage 189.37 — min gap between resume sync attempts (focus/visibility spam). */
export const PUSH_RESUME_THROTTLE_MS = 8000

/** Stage 189.38 — client ping every 30s; stale after 5 min → resume may re-sync. */
export const PUSH_PING_STALE_MS = 5 * 60 * 1000

export const PUSH_LAST_PING_OK_KEY = 'gostaylo_push_last_ping_ok'

/** Cross-mount register dedupe (same tab session). */
let sessionSynced = { uid: null, token: null }

/** Last time shouldSyncPushOnResume returned true (module scope). `0` = never. */
let lastResumeAttemptAt = 0

/** In-memory last successful ping (mirrors sessionStorage when available). */
let lastPingOkAt = 0

/** @internal tests */
export function resetPushResumeThrottleForTests() {
  lastResumeAttemptAt = 0
  lastPingOkAt = 0
}

/**
 * @param {number} [now]
 */
export function markPushPingSuccess(now = Date.now()) {
  lastPingOkAt = now
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.setItem(PUSH_LAST_PING_OK_KEY, String(now))
    } catch {
      /* ignore */
    }
  }
}

export function clearPushPingSuccess() {
  lastPingOkAt = 0
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem(PUSH_LAST_PING_OK_KEY)
    } catch {
      /* ignore */
    }
  }
}

/**
 * @param {number} [maxAgeMs]
 * @param {number} [now]
 * @returns {boolean}
 */
export function wasPushPingRecentOk(maxAgeMs = PUSH_PING_STALE_MS, now = Date.now()) {
  let ts = lastPingOkAt
  if (!ts && typeof sessionStorage !== 'undefined') {
    try {
      const raw = sessionStorage.getItem(PUSH_LAST_PING_OK_KEY)
      ts = raw ? Number(raw) : 0
      if (Number.isFinite(ts) && ts > 0) lastPingOkAt = ts
    } catch {
      ts = 0
    }
  }
  return ts > 0 && now - ts < maxAgeMs
}

/**
 * Stage 189.37 — decide if FCM register should run on app resume.
 * Does not call requestPermission. Skips when already synced this session.
 *
 * @param {string|null|undefined} userId
 * @param {{ permission?: NotificationPermission | 'unsupported', now?: number, throttleMs?: number }} [opts]
 * @returns {boolean}
 */
export function shouldSyncPushOnResume(userId, opts = {}) {
  if (!userId) return false
  const permission =
    opts.permission ??
    (typeof Notification !== 'undefined' && Notification?.permission
      ? Notification.permission
      : 'denied')
  if (permission !== 'granted') return false
  const synced = getSessionPushSync()
  const pingFresh = wasPushPingRecentOk(opts.pingStaleMs ?? PUSH_PING_STALE_MS, opts.now)
  if (synced.uid === String(userId) && synced.token && pingFresh) return false
  const now = opts.now ?? Date.now()
  const throttleMs = opts.throttleMs ?? PUSH_RESUME_THROTTLE_MS
  if (lastResumeAttemptAt > 0 && now - lastResumeAttemptAt < throttleMs) return false
  lastResumeAttemptAt = now
  return true
}

export function getSessionPushSync() {
  return sessionSynced
}

export function setSessionPushSync(uid, token) {
  sessionSynced = { uid: uid ? String(uid) : null, token: token || null }
}

export function clearSessionPushSync() {
  sessionSynced = { uid: null, token: null }
}

export function clearWebPushClientStorage() {
  if (typeof window === 'undefined') return
  clearSessionPushSync()
  clearPushPingSuccess()
  try {
    localStorage.removeItem(PUSH_FCM_TOKEN_KEY)
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.removeItem(PUSH_REGISTERED_UID_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * Unregister current device token (session cookie required). Best-effort.
 * Does not wipe other devices for the same user.
 */
export async function unregisterCurrentWebPushToken() {
  if (typeof window === 'undefined') return { ok: false, skipped: true }
  let token = ''
  try {
    token = String(localStorage.getItem(PUSH_FCM_TOKEN_KEY) || '').trim()
  } catch {
    token = ''
  }
  if (!token) {
    clearWebPushClientStorage()
    return { ok: true, skipped: true }
  }
  try {
    const { postPushAction } = await import('@/lib/api/push-client')
    const { ok, json, status } = await postPushAction({ action: 'unregister', token })
    if (!ok) {
      console.warn('[Push] unregister failed', status, json?.error || json)
    }
    return { ok, json, status }
  } catch (e) {
    console.warn('[Push] unregister error', e?.message || e)
    return { ok: false, error: e?.message || 'unregister failed' }
  } finally {
    clearWebPushClientStorage()
  }
}
