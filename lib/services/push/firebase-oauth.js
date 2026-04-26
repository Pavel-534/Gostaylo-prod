/**
 * FCM HTTP v1 — PEM нормализация и подпись JWT (RS256) для обмена на OAuth access_token.
 * Stage 51.0: вынесено из push.service.js (единая точка для ключа и подписи).
 */

/**
 * PEM из Vercel / .env часто приходит в одну строку с литералами \\n или в кавычках.
 */
export function normalizeFirebasePrivateKey(raw) {
  if (raw == null) return ''
  let k = String(raw).trim()
  k = k.replace(/^\uFEFF/, '')
  k = k.replace(/^["']+|["']+$/g, '')
  k = k.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n')
  k = k.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  return k.trim()
}

export function buildPushFirebaseConfig() {
  return {
    type: 'service_account',
    project_id: process.env.FIREBASE_PROJECT_ID || 'gostaylo-push',
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: normalizeFirebasePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
    client_email: process.env.FIREBASE_CLIENT_EMAIL?.trim().replace(/^["']|["']$/g, ''),
  }
}

export function buildFcmSendUrl(projectId) {
  const id = String(projectId || 'gostaylo-push').trim()
  return `https://fcm.googleapis.com/v1/projects/${id}/messages:send`
}

/**
 * Base64url без padding.
 */
export function base64UrlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Подпись JWT RS256 (Web Crypto) для grant_type=jwt-bearer к Google OAuth.
 */
export async function signFirebaseServiceAccountJwt(header, payload, privateKey) {
  if (typeof privateKey !== 'string' || !privateKey.includes('PRIVATE KEY')) {
    throw new Error(
      'FCM signing: FIREBASE_PRIVATE_KEY is missing or not a PEM string — set it in Vercel env (use \\n for newlines)',
    )
  }
  const encoder = new TextEncoder()

  const headerB64 = base64UrlEncode(JSON.stringify(header))
  const payloadB64 = base64UrlEncode(JSON.stringify(payload))
  const signingInput = `${headerB64}.${payloadB64}`

  let pemBody = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
  pemBody = pemBody.replace(/\s+/g, '')

  const binaryKey = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, encoder.encode(signingInput))

  const signatureB64 = base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)))

  return `${signingInput}.${signatureB64}`
}
