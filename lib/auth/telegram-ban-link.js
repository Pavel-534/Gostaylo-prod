/**
 * Signed one-time-style link payload for Telegram "ban user" URL buttons.
 * Secret: TELEGRAM_ADMIN_BAN_SECRET (fallback: JWT_SECRET via getJwtSecret).
 */
import crypto from 'crypto'
import { getJwtSecret } from '@/lib/auth/jwt-secret'

function hmacSecret() {
  const raw = (process.env.TELEGRAM_ADMIN_BAN_SECRET || '').trim()
  if (raw) return raw
  return getJwtSecret()
}

/**
 * @param {string} userId
 * @param {number} [ttlSec]
 * @returns {string} URL-safe token
 */
export function createTelegramBanLinkToken(userId, ttlSec = 48 * 3600) {
  const uid = String(userId || '').trim()
  if (!uid) throw new Error('userId required')
  const exp = Math.floor(Date.now() / 1000) + ttlSec
  const payload = Buffer.from(JSON.stringify({ u: uid, e: exp }), 'utf8').toString('base64url')
  const sig = crypto.createHmac('sha256', hmacSecret()).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

/**
 * @param {string} token
 * @returns {{ userId: string } | null}
 */
export function verifyTelegramBanLinkToken(token) {
  const raw = String(token || '').trim()
  if (!raw) return null
  const dot = raw.lastIndexOf('.')
  if (dot <= 0) return null
  const payload = raw.slice(0, dot)
  const sig = raw.slice(dot + 1)
  if (!payload || !sig) return null
  const expected = crypto.createHmac('sha256', hmacSecret()).update(payload).digest('base64url')
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  } catch {
    return null
  }
  let parsed
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  const userId = parsed?.u
  const exp = Number(parsed?.e)
  if (!userId || !Number.isFinite(exp)) return null
  if (Math.floor(Date.now() / 1000) > exp) return null
  return { userId: String(userId) }
}
