/**
 * Stage M1.1 — client FCM storage keys + logout cleanup helpers.
 * Legacy `gostaylo_*` prefix kept as internal id (not product brand).
 */

export const PUSH_FCM_TOKEN_KEY = 'gostaylo_fcm_token'
export const PUSH_REGISTERED_UID_KEY = 'gostaylo_push_registered_uid'

/** Soft CTA / Settings → PushClientInit should (re)sync after gesture grant. */
export const PUSH_ENABLE_EVENT = 'gostaylo:push-enable'

/** Cross-mount register dedupe (same tab session). */
let sessionSynced = { uid: null, token: null }

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
