import { supabaseAdmin } from '@/lib/supabase'
import {
  TABLE_MISSING_SNIPPET,
  deleteInvalidPushToken,
  recordFcmCleanedSignal,
} from '@/lib/services/push/push-transport.js'

export async function fetchUserPushTokenRows(userId) {
  let selectCols = 'token, last_seen_at, device_info'
  let { data, error } = await supabaseAdmin.from('user_push_tokens').select(selectCols).eq('user_id', userId)

  if (
    error &&
    /last_seen_at/i.test(String(error?.message || '')) &&
    /does not exist/i.test(String(error?.message || ''))
  ) {
    selectCols = 'token, device_info'
    ;({ data, error } = await supabaseAdmin.from('user_push_tokens').select(selectCols).eq('user_id', userId))
  }

  if (error) {
    if (!String(error?.message || '').includes(TABLE_MISSING_SNIPPET)) {
      console.warn('[FCM] user_push_tokens query error:', error.message)
    }
    return []
  }
  return (Array.isArray(data) ? data : [])
    .map((row) => ({
      token: String(row?.token || '').trim(),
      last_seen_at: row?.last_seen_at ?? null,
      device_info: row?.device_info && typeof row.device_info === 'object' ? row.device_info : {},
    }))
    .filter((r) => r.token)
}

export async function fetchUserTokens(userId) {
  const rows = await fetchUserPushTokenRows(userId)
  return Array.from(new Set(rows.map((r) => r.token).filter(Boolean)))
}

export async function fetchLegacyProfileToken(userId) {
  if (!userId) return ''
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('fcm_token')
      .eq('id', userId)
      .maybeSingle()
    if (error) {
      const msg = String(error?.message || '')
      if (/column .*fcm_token.* does not exist/i.test(msg)) return ''
      console.warn('[FCM] legacy profiles.fcm_token read:', msg)
      return ''
    }
    return String(data?.fcm_token || '').trim()
  } catch {
    return ''
  }
}

export async function registerToken(userId, fcmToken, deviceInfo = null) {
  try {
    const nowIso = new Date().toISOString()
    const row = {
      user_id: userId,
      token: fcmToken,
      device_info: deviceInfo && typeof deviceInfo === 'object' ? deviceInfo : {},
      last_seen_at: nowIso,
    }
    let { error } = await supabaseAdmin.from('user_push_tokens').upsert(row, {
      onConflict: 'token',
      ignoreDuplicates: false,
    })

    if (
      error &&
      /last_seen_at/i.test(String(error?.message || '')) &&
      /does not exist|column/i.test(String(error?.message || ''))
    ) {
      const { last_seen_at: _ls, ...withoutSeen } = row
      ;({ error } = await supabaseAdmin.from('user_push_tokens').upsert(withoutSeen, {
        onConflict: 'token',
        ignoreDuplicates: false,
      }))
    }

    if (error && !String(error?.message || '').includes(TABLE_MISSING_SNIPPET)) {
      throw error
    }

    await supabaseAdmin
      .from('profiles')
      .update({
        fcm_token: fcmToken,
        fcm_updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    console.log(`[FCM] Registered token for user ${userId}`)
    return { success: true }
  } catch (error) {
    console.error('[FCM] Register token error:', error.message)
    return { success: false, error: error.message }
  }
}

export async function touchTokenLastSeen(userId, fcmToken) {
  if (!userId || !fcmToken) return { success: false, error: 'userId and token required' }
  try {
    const nowIso = new Date().toISOString()
    let { data, error } = await supabaseAdmin
      .from('user_push_tokens')
      .update({ last_seen_at: nowIso })
      .eq('user_id', userId)
      .eq('token', fcmToken)
      .select('token')
    if (
      error &&
      /last_seen_at/i.test(String(error?.message || '')) &&
      /does not exist|column/i.test(String(error?.message || ''))
    ) {
      return { success: true, noop: true, reason: 'last_seen_at column missing' }
    }
    if (error) {
      if (!String(error?.message || '').includes(TABLE_MISSING_SNIPPET)) {
        console.warn('[FCM] touchTokenLastSeen:', error.message)
      }
      return { success: false, error: error.message }
    }
    if (!data?.length) return { success: false, error: 'Token not registered' }
    return { success: true }
  } catch (e) {
    return { success: false, error: e?.message || 'touch failed' }
  }
}

export async function removeInvalidToken(fcmToken) {
  return deleteInvalidPushToken(fcmToken)
}

export async function logInvalidTokenCleanup(tokenSuffix = '') {
  return recordFcmCleanedSignal(tokenSuffix)
}
