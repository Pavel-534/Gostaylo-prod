/**
 * Rate-limited signals to the system Telegram topic (self-healing / fraud / UX).
 * Avoids spamming one alert per event when bursts occur.
 *
 * Stage 56.0 — structured logs + correlation id (see `lib/request-correlation.js`).
 */

import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js'
import { getCorrelationId } from '@/lib/request-correlation.js'
import { buildFraudBanReplyMarkup } from '@/lib/services/fraud-telegram-ban-button.js'

const buckets = new Map()

const PERSISTED_SIGNAL_KEYS = new Set([
  'PRICE_TAMPERING',
  'REFERRAL_RECONCILIATION_MISMATCH',
  'ADMIN_AUDIT_WRITE_FAILED',
  'DISPUTE_RESOLUTION_SAGA_GAP',
  'POST_DISPUTE_BUCKET_DRIFT',
  'GATEWAY_LEDGER_DRIFT',
  'PENDING_FISCAL_BACKLOG',
  'REFERRAL_SHADOW_PAYMENT_INSTRUMENT',
  'REMAINING_UNVERIFIED_LOCATIONS',
  'CLUSTER_PRIVACY_RATIO',
  'POSTGIS_INDEX_HEALTH',
  'GEO_COORD_DRIFT',
  'GEO_COORDINATE_MISMATCH',
  'GEO_PRIVACY_VIOLATION',
])

/** Каждая попытка — строка в critical_signal_events (для nightly-отчётов). Таблица может отсутствовать. */
async function persistCriticalSignalRow(key, opts) {
  try {
    const { supabaseAdmin } = await import('@/lib/supabase.js')
    if (!supabaseAdmin?.from) return
    const detailLines = Array.isArray(opts.detailLines) ? opts.detailLines : []
    const severity = opts.severity ? String(opts.severity).toUpperCase() : null
    const { error } = await supabaseAdmin.from('critical_signal_events').insert({
      signal_key: String(key),
      detail: {
        correlationId: opts.correlationId || null,
        severity,
        detailLines: detailLines.slice(0, 30),
        ...(opts.persistDetail && typeof opts.persistDetail === 'object' ? opts.persistDetail : {}),
      },
    })
    if (
      error &&
      !String(error.message || '').includes("Could not find the table 'public.critical_signal_events'")
    ) {
      console.warn('[telemetry] critical_signal_events insert:', error.message)
    }
  } catch (e) {
    /* нет таблицы / нет Supabase */
  }
}

/**
 * @param {string} key — e.g. 'PRICE_MISMATCH'
 * @param {{ windowMs?: number, threshold?: number, tag?: string, detailLines?: string[], banUserId?: string | null }} opts
 */
/**
 * One JSON line per call — grep by `correlationId` across booking / payment / notification.
 * @param {{ module: string, stage: string, [k: string]: unknown }} payload
 */
export function logStructured(payload) {
  const correlationId = payload.correlationId ?? getCorrelationId()
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    type: 'service',
    correlationId: correlationId || undefined,
    ...payload,
  })
  console.log(line)
}

export function recordCriticalSignal(key, opts = {}) {
  const severity = String(opts.severity || 'WARNING').toUpperCase()
  const isCritical = severity === 'CRITICAL'
  const windowMs = opts.windowMs ?? (isCritical ? 60 * 60 * 1000 : 10 * 60 * 1000)
  const threshold = opts.threshold ?? (isCritical ? 1 : 12)
  const tag = opts.tag ?? (isCritical ? '[GEO_OPS][CRITICAL]' : '[FRAUD_DETECTION]')
  const correlationId = opts.correlationId ?? getCorrelationId()
  const detailLines = [...(Array.isArray(opts.detailLines) ? opts.detailLines : [])]
  if (correlationId) {
    detailLines.unshift(`correlationId=${correlationId}`)
  }
  if (isCritical) {
    detailLines.unshift('severity=CRITICAL')
  }

  const now = Date.now()
  let b = buckets.get(key)
  if (!b || now > b.resetAt) {
    b = { count: 0, resetAt: now + windowMs, lastAlertAt: 0 }
    buckets.set(key, b)
  }
  b.count += 1

  if (PERSISTED_SIGNAL_KEYS.has(String(key).toUpperCase())) {
    void persistCriticalSignalRow(key, { ...opts, correlationId, severity })
  }

  const minGapBetweenAlerts = isCritical ? 15 * 60 * 1000 : 30 * 60 * 1000
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
  const prefix = isCritical ? '🚨 ' : ''
  const html = `${prefix}${tag} <b>${safeKey}</b> threshold=${threshold} / ${windowMs}ms\n${body}`
  const isFraud =
    String(tag).includes('FRAUD_DETECTION') || String(key).toUpperCase().includes('FRAUD')
  const reply_markup =
    isFraud && opts.banUserId ? buildFraudBanReplyMarkup(opts.banUserId) : undefined
  void notifySystemAlert(html, reply_markup ? { reply_markup } : {})
}
