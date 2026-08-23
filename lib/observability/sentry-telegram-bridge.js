/**
 * Stage 202.0 — server-only Sentry → Telegram bridge.
 * Client must never import this for side effects beyond this module's guards.
 */

import {
  isSentryEventChunkNoise,
  scrubSentryString,
} from '@/lib/observability/sentry-scrub.js'

const COOLDOWN_MS = 5 * 60 * 1000
/** @type {Map<string, number>} */
const fingerprintCooldown = new Map()

/**
 * @param {string} fingerprint
 */
export function allowSentryTelegramFingerprint(fingerprint, now = Date.now()) {
  const fp = String(fingerprint || '').slice(0, 240) || 'unknown'
  const prev = fingerprintCooldown.get(fp) || 0
  if (now - prev < COOLDOWN_MS) return false
  fingerprintCooldown.set(fp, now)
  // Bound map size for long-lived serverless isolates
  if (fingerprintCooldown.size > 500) {
    const cutoff = now - COOLDOWN_MS
    for (const [k, t] of fingerprintCooldown) {
      if (t < cutoff) fingerprintCooldown.delete(k)
    }
  }
  return true
}

/**
 * @param {import('@sentry/core').ErrorEvent | import('@sentry/types').Event} event
 */
export function buildSentryTelegramFingerprint(event) {
  if (Array.isArray(event?.fingerprint) && event.fingerprint.length) {
    return event.fingerprint.map(String).join('|').slice(0, 240)
  }
  const first = event?.exception?.values?.[0]
  const type = String(first?.type || 'Error')
  const value = String(first?.value || event?.message || 'unknown').slice(0, 160)
  const tx = String(event?.transaction || event?.request?.url || '').slice(0, 120)
  return `${type}|${value}|${tx}`
}

/**
 * @param {import('@sentry/core').ErrorEvent | import('@sentry/types').Event} event
 * @param {{ originalException?: unknown }} [hint]
 */
export function shouldNotifySentryTelegram(event, hint = {}) {
  if (!event) return false
  const level = String(event.level || 'error').toLowerCase()
  if (level !== 'error' && level !== 'fatal') return false
  if (isSentryEventChunkNoise(event, hint)) return false
  if (!event.exception && !event.message) return false
  return true
}

/**
 * Fire-and-forget TG alert with [SENTRY] prefix (alertClass via classifySystemAlert).
 * @param {import('@sentry/core').ErrorEvent | import('@sentry/types').Event} event
 * @param {{ originalException?: unknown }} [hint]
 */
export async function maybeNotifySentryTelegram(event, hint = {}) {
  if (typeof window !== 'undefined') return
  if (!shouldNotifySentryTelegram(event, hint)) return

  const fingerprint = buildSentryTelegramFingerprint(event)
  if (!allowSentryTelegramFingerprint(fingerprint)) return

  const first = event?.exception?.values?.[0]
  const name = scrubSentryString(String(first?.type || 'Error'))
  const message = scrubSentryString(String(first?.value || event?.message || 'unknown')).slice(0, 280)
  const url = scrubSentryString(
    String(event?.request?.url || event?.transaction || event?.tags?.url || ''),
  ).slice(0, 300)
  const level = String(event.level || 'error').toUpperCase()

  try {
    const { notifySystemAlert, escapeSystemAlertHtml } = await import(
      '@/lib/services/system-alert-notify.js'
    )
    const html =
      `<b>[SENTRY]</b> ${escapeSystemAlertHtml(level)}\n` +
      `<code>${escapeSystemAlertHtml(name)}</code>: ${escapeSystemAlertHtml(message)}\n` +
      (url ? `url: <code>${escapeSystemAlertHtml(url)}</code>\n` : '') +
      `fp: <code>${escapeSystemAlertHtml(fingerprint.slice(0, 120))}</code>`

    await notifySystemAlert(html, { severity: level === 'FATAL' ? 'CRITICAL' : 'WARN' })
  } catch (e) {
    console.warn('[sentry-telegram] notify failed:', e?.message || e)
  }
}
