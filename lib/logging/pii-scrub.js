/**
 * Stage 168.2 — scrub PII from logs and persisted telemetry detail.
 */

import { createHash } from 'node:crypto'

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const PHONE_RE = /\+?\d[\d\s().-]{7,}\d/g

const SENSITIVE_KEYS = new Set([
  'email',
  'phone',
  'address',
  'raw_address',
  'street',
  'telegram_username',
  'telegram_id',
  'password',
  'token',
  'access_token',
  'refresh_token',
  'authorization',
])

/**
 * @param {string} value
 */
export function hashPiiForLog(value) {
  const s = String(value || '').trim()
  if (!s) return '[REDACTED]'
  const hash = createHash('sha256').update(`pii:v1:${s}`).digest('hex').slice(0, 12)
  return `[HASH:${hash}]`
}

/**
 * @param {unknown} input
 */
export function scrubPiiString(input) {
  if (input == null) return input
  let s = String(input)
  s = s.replace(EMAIL_RE, '[REDACTED_EMAIL]')
  s = s.replace(PHONE_RE, '[REDACTED_PHONE]')
  return s
}

/**
 * @param {unknown} value
 * @param {number} [depth]
 */
export function scrubPiiValue(value, depth = 0) {
  if (depth > 10) return '[DEPTH_LIMIT]'
  if (value == null) return value
  if (typeof value === 'string') return scrubPiiString(value)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.map((v) => scrubPiiValue(v, depth + 1))
  if (typeof value === 'object') {
    /** @type {Record<string, unknown>} */
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      const key = k.toLowerCase()
      if (SENSITIVE_KEYS.has(key)) {
        out[k] = typeof v === 'string' ? hashPiiForLog(v) : '[REDACTED]'
      } else {
        out[k] = scrubPiiValue(v, depth + 1)
      }
    }
    return out
  }
  return value
}

/**
 * @param {unknown[]} lines
 */
export function scrubPiiDetailLines(lines) {
  if (!Array.isArray(lines)) return []
  return lines.map((line) => scrubPiiString(String(line)))
}
