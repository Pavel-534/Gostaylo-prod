/**
 * Stage 105 / 125.5 — мониторинг казначейства: Telegram FINANCE + append-only `critical_signal_events`.
 * system_settings больше не используется для операционных алертов — только глобальные настройки (pause, manual mode).
 */

import { supabaseAdmin } from '@/lib/supabase'
import LedgerService from '@/lib/services/ledger.service.js'
import { sendToAdminTopic } from '@/lib/services/notifications/telegram.service.js'
import { escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js'
import { logStructured } from '@/lib/critical-telemetry.js'
import { loadTreasuryRailsSummary } from '@/lib/treasury/treasury-rails-summary.js'
import {
  getTreasuryAlertThresholdsFromEnv,
  loadTreasuryOpsSettings,
} from '@/lib/treasury/treasury-ops-config.js'
import { getPayoutRailMeta } from '@/lib/treasury/payout-rails.js'
import { getPublicSiteUrl } from '@/lib/site-url.js'

export const TREASURY_ALERT_TYPES = Object.freeze({
  PAYMENT_LARGE: 'TREASURY_PAYMENT_LARGE',
  READY_POOL: 'TREASURY_READY_POOL',
  LEDGER_DRIFT: 'TREASURY_LEDGER_DRIFT',
  FISCAL_PENDING: 'TREASURY_FISCAL_PENDING',
  WEBHOOK_ERROR: 'TREASURY_WEBHOOK_ERROR',
  EMERGENCY_PAUSE: 'TREASURY_EMERGENCY_PAUSE',
  LEGACY_PAYOUT_BLOCKED: 'TREASURY_LEGACY_PAYOUT_BLOCKED',
  CRON_STALE: 'TREASURY_CRON_STALE',
  CONTROLLED_LIVE_ACTIVATED: 'TREASURY_CONTROLLED_LIVE_ACTIVATED',
  FIRST_REAL_PAYMENT_DETECTED: 'TREASURY_FIRST_REAL_PAYMENT_DETECTED',
  CONTROLLED_LIVE_DAILY_LIMIT: 'TREASURY_CONTROLLED_LIVE_DAILY_LIMIT',
})

const TREASURY_SIGNAL_KEYS = new Set(Object.values(TREASURY_ALERT_TYPES))
const MAX_ALERTS_LOAD = 80

const cooldownBuckets = new Map()
const COOLDOWN_MS = 30 * 60 * 1000

function shouldSendTelegram(alertKey) {
  const now = Date.now()
  const prev = cooldownBuckets.get(alertKey) || 0
  if (now - prev < COOLDOWN_MS) return false
  cooldownBuckets.set(alertKey, now)
  return true
}

function mapCriticalSignalRowToAlert(row) {
  const d = row?.detail && typeof row.detail === 'object' && !Array.isArray(row.detail) ? row.detail : {}
  return {
    id: row.id,
    type: row.signal_key,
    severity: d.severity || 'warn',
    title: d.title || row.signal_key,
    detail: typeof d.detail === 'string' ? d.detail : '',
    meta: d.meta && typeof d.meta === 'object' ? d.meta : {},
    at: row.created_at,
    telegramSent: Boolean(d.telegramSent),
  }
}

/**
 * FinTech / Cron Health — recent treasury alerts from append-only journal.
 * @param {number} [limit]
 */
export async function loadRecentTreasuryOpsAlerts(limit = MAX_ALERTS_LOAD) {
  if (!supabaseAdmin?.from) return []
  try {
    const { data, error } = await supabaseAdmin
      .from('critical_signal_events')
      .select('id, signal_key, created_at, detail')
      .in('signal_key', [...TREASURY_SIGNAL_KEYS])
      .order('created_at', { ascending: false })
      .limit(Math.max(1, Math.min(limit, MAX_ALERTS_LOAD)))

    if (error) {
      if (!String(error.message || '').includes("Could not find the table 'public.critical_signal_events'")) {
        console.warn('[treasury-alerts] loadRecentTreasuryOpsAlerts:', error.message)
      }
      return []
    }
    return (data || []).map(mapCriticalSignalRowToAlert)
  } catch {
    return []
  }
}

/**
 * Stage 106.4b — prune test treasury rows from critical_signal_events (not system_settings).
 * @param {(alert: object) => boolean} shouldRemove
 */
export async function pruneTreasuryOpsAlerts(shouldRemove) {
  if (!supabaseAdmin?.from) return { removed: 0, kept: 0 }
  const recent = await loadRecentTreasuryOpsAlerts(500)
  const removeIds = recent.filter((a) => shouldRemove(a)).map((a) => a.id).filter(Boolean)
  if (!removeIds.length) return { removed: 0, kept: recent.length }

  const { error } = await supabaseAdmin.from('critical_signal_events').delete().in('id', removeIds)
  if (error) {
    console.warn('[treasury-alerts] pruneTreasuryOpsAlerts:', error.message)
    return { removed: 0, kept: recent.length }
  }
  return { removed: removeIds.length, kept: recent.length - removeIds.length }
}

async function persistCriticalSignal(signalKey, detail) {
  const rowShape = {
    type: signalKey,
    severity: detail.severity || 'warn',
    title: detail.title || signalKey,
    detail: detail.detail || '',
    meta: detail.meta || {},
    at: new Date().toISOString(),
    telegramSent: Boolean(detail.telegramSent),
  }

  try {
    if (!supabaseAdmin?.from) return rowShape
    const { data, error } = await supabaseAdmin
      .from('critical_signal_events')
      .insert({
        signal_key: signalKey,
        detail: {
          severity: rowShape.severity,
          title: rowShape.title,
          detail: rowShape.detail,
          meta: rowShape.meta,
          telegramSent: rowShape.telegramSent,
        },
      })
      .select('id, signal_key, created_at, detail')
      .single()

    if (error) {
      if (!String(error.message || '').includes("Could not find the table 'public.critical_signal_events'")) {
        console.warn('[treasury-alerts] critical_signal_events insert:', error.message)
      }
      return rowShape
    }
    return mapCriticalSignalRowToAlert(data)
  } catch {
    return rowShape
  }
}

/**
 * @param {{
 *   type: string,
 *   severity?: 'info' | 'warn' | 'critical',
 *   title: string,
 *   detail?: string,
 *   meta?: object,
 *   telegramHtml?: string,
 *   skipTelegram?: boolean,
 * }} opts
 */
export async function recordTreasuryOpsAlert(opts) {
  const severity = opts.severity || 'warn'
  const telegramSent =
    !opts.skipTelegram &&
    opts.telegramHtml &&
    shouldSendTelegram(`${opts.type}:${opts.title}`)

  if (telegramSent) {
    void sendToAdminTopic('FINANCE', opts.telegramHtml).catch(() => {})
  }

  const row = await persistCriticalSignal(opts.type, {
    severity,
    title: opts.title,
    detail: opts.detail,
    meta: opts.meta,
    telegramSent: Boolean(telegramSent),
  })

  logStructured({
    module: 'treasury-monitoring-alerts',
    stage: 'recordTreasuryOpsAlert',
    type: opts.type,
    severity,
    title: opts.title,
    telegramSent: Boolean(telegramSent),
  })

  return row
}

/**
 * Крупная оплата (после escrow).
 * @param {{ bookingId: string, amountThb: number, listingTitle?: string, method?: string }} payload
 */
export async function maybeAlertLargePayment(payload) {
  const ops = await loadTreasuryOpsSettings()
  const min = Number(ops.alertThresholds?.paymentThbMin) || 50_000
  const amount = Number(payload.amountThb) || 0
  if (amount < min) return

  const html =
    `💰 <b>Крупная оплата</b> (≥ ฿${min.toLocaleString('ru-RU')})\n\n` +
    `📝 Бронь: <code>${escapeSystemAlertHtml(payload.bookingId)}</code>\n` +
    `📍 ${escapeSystemAlertHtml(payload.listingTitle || '—')}\n` +
    `💵 <b>฿${amount.toLocaleString('ru-RU')}</b>\n` +
    `🔗 ${escapeSystemAlertHtml(payload.method || '—')}\n` +
    `🕐 ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Bangkok' })}`

  return recordTreasuryOpsAlert({
    type: TREASURY_ALERT_TYPES.PAYMENT_LARGE,
    severity: 'info',
    title: `Крупная оплата ฿${amount.toLocaleString('ru-RU')}`,
    detail: payload.bookingId,
    meta: payload,
    telegramHtml: html,
  })
}

/**
 * @param {{ readyThb: number, readyCount: number, rail?: string }} payload
 */
export async function maybeAlertReadyPool(payload) {
  const ops = await loadTreasuryOpsSettings()
  const min = Number(ops.alertThresholds?.readyPoolThbMin) || 100_000
  const readyThb = Number(payload.readyThb) || 0
  if (readyThb < min) return

  const railLabel = payload.rail ? getPayoutRailMeta(payload.rail).ownerLabel : 'всего'
  const html =
    `📦 <b>Готово к выплате</b> (≥ ฿${min.toLocaleString('ru-RU')})\n\n` +
    `Рельс: <b>${escapeSystemAlertHtml(railLabel)}</b>\n` +
    `Броней: <b>${payload.readyCount ?? 0}</b>\n` +
    `Сумма: <b>฿${readyThb.toLocaleString('ru-RU')}</b>\n` +
    `<a href="${getPublicSiteUrl()}/admin/settings/finances">Финансовый пульт</a>`

  return recordTreasuryOpsAlert({
    type: TREASURY_ALERT_TYPES.READY_POOL,
    severity: 'warn',
    title: `Готово к выплате ฿${readyThb.toLocaleString('ru-RU')} (${railLabel})`,
    detail: `${payload.readyCount} броней`,
    meta: payload,
    telegramHtml: html,
  })
}

/**
 * @param {{ driftThb: number, reconciliation?: object }} payload
 */
export async function maybeAlertLedgerDrift(payload) {
  const ops = await loadTreasuryOpsSettings()
  const min = Number(ops.alertThresholds?.ledgerDriftThbMin) ?? 0.5
  const drift = Math.abs(Number(payload.driftThb) || 0)
  if (drift <= min) return

  const html =
    `⚖️ <b>Ledger drift</b> &gt; ฿${min}\n\n` +
    `Расхождение: <b>฿${drift.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}</b>\n` +
    `Сверьте книгу в финпульте перед выплатой.`

  return recordTreasuryOpsAlert({
    type: TREASURY_ALERT_TYPES.LEDGER_DRIFT,
    severity: 'critical',
    title: `Drift ledger ฿${drift.toFixed(2)}`,
    detail: JSON.stringify(payload.reconciliation || {}).slice(0, 400),
    meta: { driftThb: drift },
    telegramHtml: html,
  })
}

/**
 * @param {{ count: number }} payload
 */
export async function maybeAlertFiscalPending(payload) {
  const count = Number(payload.count) || 0
  if (count < 1) return

  const html =
    `🧾 <b>Онлайн-касса: PENDING_FISCAL</b>\n\n` +
    `Броней без чека: <b>${count}</b>\n` +
    `Проверьте FISCAL_PROVIDER_URL и cron fiscal.`

  return recordTreasuryOpsAlert({
    type: TREASURY_ALERT_TYPES.FISCAL_PENDING,
    severity: 'warn',
    title: `PENDING_FISCAL: ${count}`,
    detail: `${count} броней`,
    meta: payload,
    telegramHtml: html,
  })
}

/**
 * @param {{ error: string, bookingId?: string, context?: string }} payload
 */
export async function recordTreasuryWebhookError(payload) {
  const html =
    `💳 <b>Ошибка webhook оплаты</b>\n` +
    `${payload.context ? `\n${escapeSystemAlertHtml(payload.context)}\n` : ''}` +
    `${payload.bookingId ? `Бронь: <code>${escapeSystemAlertHtml(payload.bookingId)}</code>\n` : ''}` +
    `<code>${escapeSystemAlertHtml(String(payload.error || '').slice(0, 300))}</code>`

  return recordTreasuryOpsAlert({
    type: TREASURY_ALERT_TYPES.WEBHOOK_ERROR,
    severity: 'critical',
    title: 'Webhook payments/confirm',
    detail: payload.error,
    meta: payload,
    telegramHtml: html,
  })
}

/**
 * Периодическая сверка для дашборда (без спама TG на каждый refresh — только при превышении порога).
 */
export async function runTreasuryMonitoringScan() {
  const ops = await loadTreasuryOpsSettings()
  const thresholds = ops.alertThresholds || getTreasuryAlertThresholdsFromEnv()

  let reconciliation = null
  let driftThb = 0
  try {
    reconciliation = await LedgerService.runReconciliationMvp()
    driftThb = Math.abs(Number(reconciliation?.deltaThb) || 0)
  } catch (e) {
    reconciliation = { error: e?.message || String(e) }
  }

  let pendingFiscalCount = 0
  if (supabaseAdmin) {
    const { count } = await supabaseAdmin
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .filter('metadata->fiscal->>status', 'eq', 'PENDING_FISCAL')
    pendingFiscalCount = count ?? 0
  }

  const railsSummary = await loadTreasuryRailsSummary()

  if (driftThb > thresholds.ledgerDriftThbMin) {
    await maybeAlertLedgerDrift({ driftThb, reconciliation })
  }
  if (pendingFiscalCount >= thresholds.fiscalPendingMin) {
    await maybeAlertFiscalPending({ count: pendingFiscalCount })
  }
  if (railsSummary.totalReadyThb >= thresholds.readyPoolThbMin) {
    await maybeAlertReadyPool({
      readyThb: railsSummary.totalReadyThb,
      readyCount: railsSummary.totalReadyCount,
    })
  }
  for (const railId of ['TBANK_RU', 'KG_CRYPTO']) {
    const r = railsSummary.rails?.[railId]
    if (r && r.readyThb >= thresholds.readyPoolThbMin) {
      await maybeAlertReadyPool({
        readyThb: r.readyThb,
        readyCount: r.readyCount,
        rail: railId,
      })
    }
  }

  const refreshed = await loadTreasuryOpsSettings()
  const recentAlerts = await loadRecentTreasuryOpsAlerts()

  return {
    reconciliation,
    driftThb,
    pendingFiscalCount,
    railsSummary,
    thresholds,
    ops: { ...refreshed, recentAlerts },
    recentAlerts,
  }
}
