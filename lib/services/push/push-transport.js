/**
 * FCM transport — OAuth, HTTP v1 send, token hygiene (Stage 70.6).
 */

import { supabaseAdmin } from '@/lib/supabase'
import {
  buildPushFirebaseConfig,
  buildFcmSendUrl,
  signFirebaseServiceAccountJwt,
  base64UrlEncode as firebaseBase64UrlEncode,
} from '@/lib/services/push/firebase-oauth.js'
import { postFcmV1Message, parseFcmHttpError } from '@/lib/services/push/fcm-http-delivery.js'

export const TABLE_MISSING_SNIPPET = "Could not find the table 'public.user_push_tokens'"

const FIREBASE_CONFIG = buildPushFirebaseConfig()
export const FCM_SEND_URL = buildFcmSendUrl(FIREBASE_CONFIG.project_id)

let accessToken = null
let tokenExpiry = 0

export function logPushSentTrace(userId, status, fcmToken) {
  const snippet = String(fcmToken || '').slice(0, 10)
  const safe = String(status ?? '')
    .replace(/\r?\n/g, ' ')
    .slice(0, 240)
  console.log(`[PUSH_SENT] To: ${userId ?? '?'}, Status: ${safe}, Token_Snippet: ${snippet}`)
}

export async function getFcmAccessToken() {
  const now = Date.now()

  if (accessToken && tokenExpiry > now + 60000) {
    return accessToken
  }

  if (!FIREBASE_CONFIG.client_email || !FIREBASE_CONFIG.private_key) {
    const msg =
      'Firebase service account missing: set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY (and FIREBASE_PROJECT_ID) in Vercel'
    console.error('[FCM] Token error:', msg)
    throw new Error(msg)
  }

  const header = {
    alg: 'RS256',
    typ: 'JWT',
  }

  const claimSet = {
    iss: FIREBASE_CONFIG.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + 3600,
  }

  const signedJwt = await signFirebaseServiceAccountJwt(header, claimSet, FIREBASE_CONFIG.private_key)

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signedJwt,
    }),
  })

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text()
    console.error('[FCM] Token error:', error)
    throw new Error('Failed to get access token')
  }

  const tokenData = await tokenResponse.json()
  accessToken = tokenData.access_token
  tokenExpiry = now + tokenData.expires_in * 1000

  console.log('[FCM] Got new access token, expires in', tokenData.expires_in, 'seconds')
  return accessToken
}

export async function deleteInvalidPushToken(fcmToken) {
  if (!fcmToken) return
  const { error } = await supabaseAdmin.from('user_push_tokens').delete().eq('token', fcmToken)
  if (error && !String(error?.message || '').includes(TABLE_MISSING_SNIPPET)) {
    console.warn('[FCM] delete stale token:', error.message)
  } else {
    console.log(`[FCM] Removed invalid token ...${String(fcmToken).slice(-8)}`)
    void recordFcmCleanedSignal(String(fcmToken).slice(-8))
  }
  const { error: profErr } = await supabaseAdmin
    .from('profiles')
    .update({ fcm_token: null, fcm_updated_at: new Date().toISOString() })
    .eq('fcm_token', fcmToken)
  if (profErr && !String(profErr?.message || '').includes('column')) {
    console.warn('[FCM] clear profiles.fcm_token:', profErr.message)
  }
}

export async function recordFcmCleanedSignal(tokenSuffix = '') {
  try {
    const { error } = await supabaseAdmin.from('critical_signal_events').insert({
      signal_key: 'FCM_TOKEN_CLEANED',
      detail: { tokenSuffix, source: 'push-transport.deleteInvalidPushToken' },
    })
    if (
      error &&
      !String(error.message || '').includes("Could not find the table 'public.critical_signal_events'")
    ) {
      console.warn('[FCM] critical_signal_events insert:', error.message)
    }
  } catch {
    /* optional telemetry */
  }
}

/**
 * POST FCM message; on stale registration, deletes token.
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
export async function deliverFcmNotification({
  fcmToken,
  message,
  traceUid = '?',
  templateKey = '',
}) {
  const tokenStr = String(fcmToken)
  try {
    const access = await getFcmAccessToken()
    const response = await postFcmV1Message(FCM_SEND_URL, access, message)
    const rawText = response.rawText
    const verbose = process.env.FCM_VERBOSE_LOG === '1'

    console.log('[FCM Debug] Target profile:', traceUid)
    console.log(
      '[FCM Debug] Token used:',
      tokenStr.length > 12 ? `${tokenStr.slice(0, 10)}…(len=${tokenStr.length})` : `(short token)`,
    )
    if (verbose) {
      console.log('[FCM Debug] template / full outbound:', templateKey, JSON.stringify(message, null, 2))
    } else {
      console.log('[FCM Debug] template / outbound summary key:', templateKey)
    }
    if (!verbose) {
      console.log(
        '[FCM Debug] Outbound summary:',
        JSON.stringify({
          hasNotification: Boolean(message.message.notification),
          hasWebpushNotification: Boolean(message.message.webpush?.notification),
          dataKeys: Object.keys(message.message.data || {}),
          android: message.message.android,
        }),
      )
    }

    console.log('[FCM Debug] Firebase HTTP:', response.status, response.ok ? 'OK' : 'ERR')
    console.log(
      '[FCM Debug] Firebase response:',
      verbose
        ? rawText
        : `${String(rawText).slice(0, 1200)}${String(rawText).length > 1200 ? '…(truncated; set FCM_VERBOSE_LOG=1 for full)' : ''}`,
    )

    if (!response.ok) {
      const { message: errMsg, stale } = parseFcmHttpError(rawText, response.status)
      if (stale) await deleteInvalidPushToken(fcmToken)
      const statusLine = stale ? `STALE_HTTP_${response.status}` : `FAIL_HTTP_${response.status}`
      logPushSentTrace(traceUid, `${statusLine}:${errMsg}`, fcmToken)
      console.error('[FCM] Send error:', errMsg, stale ? '(stale token removed)' : '', {
        status: response.status,
        bodyPreview: String(rawText).slice(0, 500),
      })
      return { success: false, error: errMsg }
    }

    let result
    try {
      result = JSON.parse(rawText)
    } catch {
      logPushSentTrace(traceUid, 'FAIL:200:invalid_json', fcmToken)
      return { success: false, error: 'Invalid FCM response JSON' }
    }
    console.log(`[FCM] Sent ${templateKey} name=${result?.name || '?'} token …${tokenStr.slice(-6)}`)
    logPushSentTrace(traceUid, `OK:${result?.name || '?'}`, fcmToken)
    return { success: true, messageId: result.name }
  } catch (error) {
    const em = String(error?.message || error)
    if (
      /Requested entity was not found|registration-token-not-registered|not a valid FCM registration token/i.test(
        em,
      )
    ) {
      await deleteInvalidPushToken(fcmToken)
    }
    logPushSentTrace(traceUid, `EX:${em}`, fcmToken)
    console.error('[FCM] Send exception:', em, error?.stack)
    return { success: false, error: em }
  }
}

export function parseFcmHttpErrorExported(rawText, responseHttpStatus = 0) {
  return parseFcmHttpError(rawText, responseHttpStatus)
}

/** @deprecated Use {@link signFirebaseServiceAccountJwt} from firebase-oauth.js */
export async function signJwt(header, payload, privateKey) {
  return signFirebaseServiceAccountJwt(header, payload, privateKey)
}

/** @deprecated Use {@link firebaseBase64UrlEncode} from firebase-oauth.js */
export function base64UrlEncode(str) {
  return firebaseBase64UrlEncode(str)
}

/**
 * Держит setTimeout живым на Vercel (waitUntil); локально — fire-and-forget.
 */
export async function scheduleBackgroundWork(task) {
  const promise = (async () => {
    try {
      await task()
    } catch (e) {
      console.error('[FCM] Background task error:', e?.message || e)
    }
  })()
  try {
    const { waitUntil } = await import('@vercel/functions')
    if (typeof waitUntil === 'function') {
      waitUntil(promise)
      return
    }
  } catch {
    // пакет отсутствует или не Vercel
  }
  void promise
}
