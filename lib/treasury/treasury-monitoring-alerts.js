/**
 * Stage 105 — мониторинг казначейства: Telegram FINANCE + журнал в system_settings + critical_signal_events.
 */

import { supabaseAdmin } from '@/lib/supabase'
import LedgerService from '@/lib/services/ledger.service.js'
import { sendToAdminTopic } from '@/lib/services/notifications/telegram.service.js'
import { escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js'
import { loadTreasuryRailsSummary } from '@/lib/treasury/treasury-rails-summary.js'
import {
  appendTreasuryOpsAlert,
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
})

const cooldownBuckets = new Map()
const COOLDOWN_MS = 30 * 60 * 1000

function shouldSendTelegram(alertKey) {
  const now = Date.now()
  const prev = cooldownBuckets.get(alertKey) || 0
  if (now - prev < COOLDOWN_MS) return false
  cooldownBuckets.set(alertKey, now)
  return true
}

async function persistCriticalSignal(signalKey, detail) {
  try {
    if (!supabaseAdmin?.from) return
    await supabaseAdmin.from('critical_signal_events').insert({
      signal_key: signalKey,
      detail,
    })
  } catch {
    /* table may be missing */
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

  const row = await appendTreasuryOpsAlert({
    type: opts.type,
    severity,
    title: opts.title,
    detail: opts.detail,
    meta: opts.meta,
    telegramSent: Boolean(telegramSent),
  })

  void persistCriticalSignal(opts.type, {
    severity,
    title: opts.title,
    detail: opts.detail,
    meta: opts.meta,
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

  return {
    reconciliation,
    driftThb,
    pendingFiscalCount,
    railsSummary,
    thresholds,
    ops: refreshed,
    recentAlerts: refreshed.recentAlerts || [],
  }
}
