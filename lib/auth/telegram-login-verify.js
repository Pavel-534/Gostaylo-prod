/**
 * Stage 189.0 — Telegram Login Widget hash verification (SSOT).
 * @see https://core.telegram.org/widgets/login#checking-authorization
 */
import crypto from 'crypto'

/**
 * @param {Record<string, string | number>} authData — fields from widget callback (incl. hash)
 * @param {string} botToken
 * @returns {{ ok: true, data: Record<string, string> } | { ok: false, error: string }}
 */
export function verifyTelegramLoginAuth(authData, botToken) {
  const token = String(botToken || '').trim()
  if (!token) return { ok: false, error: 'bot_token_missing' }

  const raw = authData && typeof authData === 'object' ? authData : {}
  const hash = String(raw.hash || '').trim()
  if (!hash) return { ok: false, error: 'hash_missing' }

  const pairs = Object.keys(raw)
    .filter((k) => k !== 'hash')
    .sort()
    .map((k) => `${k}=${raw[k]}`)

  const dataCheckString = pairs.join('\n')
  const secret = crypto.createHash('sha256').update(token).digest()
  const computed = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex')

  if (computed !== hash) return { ok: false, error: 'hash_mismatch' }

  const authDate = Number(raw.auth_date)
  if (!Number.isFinite(authDate)) return { ok: false, error: 'auth_date_invalid' }

  const maxAgeSec = Number(process.env.TELEGRAM_LOGIN_MAX_AGE_SEC || 86400)
  const now = Math.floor(Date.now() / 1000)
  if (now - authDate > maxAgeSec) return { ok: false, error: 'auth_expired' }

  const normalized = Object.fromEntries(
    Object.entries(raw)
      .filter(([k]) => k !== 'hash')
      .map(([k, v]) => [k, String(v)]),
  )

  return { ok: true, data: normalized }
}
