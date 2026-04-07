/**
 * Rate-limited signals to the system Telegram topic (self-healing / fraud / UX).
 * Avoids spamming one alert per event when bursts occur.
 */

import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js'
import { buildFraudBanReplyMarkup } from '@/lib/services/fraud-telegram-ban-button.js'

const buckets = new Map()

/**
 * @param {string} key — e.g. 'PRICE_MISMATCH'
 * @param {{ windowMs?: number, threshold?: number, tag?: string, detailLines?: string[], banUserId?: string | null }} opts
 */
export function recordCriticalSignal(key, opts = {}) {
  const windowMs = opts.windowMs ?? 10 * 60 * 1000
  const threshold = opts.threshold ?? 12
  const tag = opts.tag ?? '[FRAUD_DETECTION]'
  const detailLines = Array.isArray(opts.detailLines) ? opts.detailLines : []

  const now = Date.now()
  let b = buckets.get(key)
  if (!b || now > b.resetAt) {
    b = { count: 0, resetAt: now + windowMs, lastAlertAt: 0 }
    buckets.set(key, b)
  }
  b.count += 1

  const minGapBetweenAlerts = 30 * 60 * 1000
  if (b.count < threshold) return
  if (b.lastAlertAt && now - b.lastAlertAt < minGapBetweenAlerts) return

  b.lastAlertAt = now
  b.count = 0
  b.resetAt = now + windowMs

  const safeKey = escapeSystemAlertHtml(key)
  const body = detailLines
    .slice(0, 12)
    .map((l) => escapeSystemAlertHtml(l))
    .join('\n')
  const html = `${tag} <b>${safeKey}</b> threshold=${threshold} / ${windowMs}ms\n${body}`
  const isFraud =
    String(tag).includes('FRAUD_DETECTION') || String(key).toUpperCase().includes('FRAUD')
  const reply_markup =
    isFraud && opts.banUserId ? buildFraudBanReplyMarkup(opts.banUserId) : undefined
  void notifySystemAlert(html, reply_markup ? { reply_markup } : {})
}
