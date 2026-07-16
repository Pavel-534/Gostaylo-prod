/**
 * Capacitor → Airento push bridge (Stage 172.0).
 * Registers native device token with existing POST /api/v2/push (action: register).
 * Does not replace web FCM / SW path for Safari PWA.
 */

/**
 * @param {{
 *   token: string,
 *   platform: 'ios' | 'android',
 *   credentials?: RequestCredentials,
 *   baseUrl?: string,
 * }} opts
 */
export async function registerCapacitorPushToken({
  token,
  platform,
  credentials = 'include',
  baseUrl = '',
}) {
  const t = String(token || '').trim()
  if (!t) return { success: false, error: 'token required' }
  if (platform !== 'ios' && platform !== 'android') {
    return { success: false, error: 'platform must be ios|android' }
  }

  const res = await fetch(`${baseUrl}/api/v2/push`, {
    method: 'POST',
    credentials,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'register',
      token: t,
      deviceInfo: {
        platform,
        source: 'capacitor',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'capacitor',
      },
    }),
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    return {
      success: false,
      error: json?.error || `HTTP ${res.status}`,
      status: res.status,
    }
  }
  return json
}
