/**
 * Stage 105 — SSOT режима казначейства: ручной Concierge, emergency pause, пороги алертов.
 */

import { supabaseAdmin } from '@/lib/supabase'

const GENERAL_KEY = 'general'
const MAX_ALERTS_RING = 80

function parseEnvBool(val, defaultTrue = true) {
  if (val === undefined || val === null || String(val).trim() === '') return defaultTrue
  const s = String(val).trim().toLowerCase()
  return !['0', 'false', 'no', 'off'].includes(s)
}

/** @returns {boolean} По умолчанию true — авто-выплаты/пулы из cron выключены, пока явно не сняли. */
export function isTreasuryManualModeFromEnv() {
  return parseEnvBool(process.env.TREASURY_MANUAL_MODE, true)
}

export function isTreasuryAutoPoolFromEnv() {
  return parseEnvBool(process.env.TREASURY_AUTO_POOL, false)
}

export function isTreasuryAutoPromoteFromEnv() {
  return parseEnvBool(process.env.TREASURY_AUTO_PROMOTE, false)
}

export function getTreasuryAlertThresholdsFromEnv() {
  const num = (key, fallback) => {
    const n = Number(process.env[key])
    return Number.isFinite(n) && n >= 0 ? n : fallback
  }
  return {
    paymentThbMin: num('TREASURY_ALERT_PAYMENT_THB_MIN', 50_000),
    readyPoolThbMin: num('TREASURY_ALERT_READY_POOL_THB_MIN', 100_000),
    ledgerDriftThbMin: num('TREASURY_ALERT_LEDGER_DRIFT_THB_MIN', 0.5),
    fiscalPendingMin: 1,
  }
}

/**
 * @typedef {{
 *   treasuryManualMode: boolean,
 *   treasuryAutoPool: boolean,
 *   treasuryAutoPromote: boolean,
 *   emergencyPause: { active: boolean, reason?: string, pausedAt?: string, pausedBy?: string } | null,
 *   alertThresholds: ReturnType<typeof getTreasuryAlertThresholdsFromEnv>,
 *   recentAlerts: object[],
 * }} TreasuryOpsSnapshot
 */

/**
 * @returns {Promise<TreasuryOpsSnapshot>}
 */
export async function loadTreasuryOpsSettings() {
  const thresholds = getTreasuryAlertThresholdsFromEnv()
  const base = {
    treasuryManualMode: isTreasuryManualModeFromEnv(),
    treasuryAutoPool: false,
    treasuryAutoPromote: false,
    emergencyPause: null,
    alertThresholds: thresholds,
    recentAlerts: [],
  }

  if (!supabaseAdmin) return base

  const { data: row } = await supabaseAdmin
    .from('system_settings')
    .select('value')
    .eq('key', GENERAL_KEY)
    .maybeSingle()

  const v = row?.value && typeof row.value === 'object' ? row.value : {}

  if (typeof v.treasury_manual_mode === 'boolean') {
    base.treasuryManualMode = v.treasury_manual_mode
  }
  if (typeof v.treasury_auto_pool === 'boolean') {
    base.treasuryAutoPool = v.treasury_auto_pool
  }
  if (typeof v.treasury_auto_promote === 'boolean') {
    base.treasuryAutoPromote = v.treasury_auto_promote
  }
  if (v.treasury_emergency_pause && typeof v.treasury_emergency_pause === 'object') {
    base.emergencyPause = {
      active: Boolean(v.treasury_emergency_pause.active),
      reason: v.treasury_emergency_pause.reason || '',
      pausedAt: v.treasury_emergency_pause.pausedAt || null,
      pausedBy: v.treasury_emergency_pause.pausedBy || null,
    }
  }
  if (v.treasury_alert_thresholds && typeof v.treasury_alert_thresholds === 'object') {
    base.alertThresholds = {
      ...thresholds,
      ...v.treasury_alert_thresholds,
    }
  }
  if (Array.isArray(v.treasury_ops_alerts)) {
    base.recentAlerts = v.treasury_ops_alerts.slice(0, MAX_ALERTS_RING)
  }

  if (base.treasuryManualMode) {
    base.treasuryAutoPool = false
    base.treasuryAutoPromote = false
  } else {
    base.treasuryAutoPool = base.treasuryAutoPool || isTreasuryAutoPoolFromEnv()
    base.treasuryAutoPromote = base.treasuryAutoPromote || isTreasuryAutoPromoteFromEnv()
  }

  return base
}

/**
 * @param {'booking' | 'payout' | 'auto_pool' | 'auto_promote'} action
 */
export async function assertTreasuryOpsAllowed(action) {
  const ops = await loadTreasuryOpsSettings()
  if (ops.emergencyPause?.active) {
    return {
      allowed: false,
      code: 'EMERGENCY_PAUSE',
      message:
        ops.emergencyPause.reason ||
        'Платформа на паузе: новые бронирования и выплаты временно заблокированы.',
    }
  }
  if (action === 'auto_pool' && (ops.treasuryManualMode || !ops.treasuryAutoPool)) {
    return {
      allowed: false,
      code: 'TREASURY_MANUAL_MODE',
      message: 'Авто-пулы отключены (TREASURY_MANUAL_MODE / ручной Concierge).',
    }
  }
  if (action === 'auto_promote' && (ops.treasuryManualMode || !ops.treasuryAutoPromote)) {
    return {
      allowed: false,
      code: 'TREASURY_MANUAL_MODE',
      message: 'Авто-promote отключён (ручной режим казначейства).',
    }
  }
  return { allowed: true, ops }
}

async function mergeGeneralSettings(patch) {
  if (!supabaseAdmin) return { success: false, error: 'no_db' }

  const { data: row } = await supabaseAdmin
    .from('system_settings')
    .select('id, value')
    .eq('key', GENERAL_KEY)
    .maybeSingle()

  const prev = row?.value && typeof row.value === 'object' ? row.value : {}
  const next = { ...prev, ...patch }

  if (row?.id) {
    const { error } = await supabaseAdmin
      .from('system_settings')
      .update({ value: next, updated_at: new Date().toISOString() })
      .eq('id', row.id)
    if (error) return { success: false, error: error.message }
  } else {
    const { error } = await supabaseAdmin.from('system_settings').insert({
      key: GENERAL_KEY,
      value: next,
    })
    if (error) return { success: false, error: error.message }
  }
  return { success: true, value: next }
}

/**
 * @param {{ active: boolean, reason?: string, pausedBy?: string }} input
 */
export async function setTreasuryEmergencyPause(input) {
  const pause = input.active
    ? {
        active: true,
        reason: String(input.reason || 'Emergency pause (FinTech)').slice(0, 500),
        pausedAt: new Date().toISOString(),
        pausedBy: input.pausedBy || null,
      }
    : { active: false, clearedAt: new Date().toISOString() }

  return mergeGeneralSettings({ treasury_emergency_pause: pause })
}

/**
 * @param {boolean} manualMode
 */
export async function setTreasuryManualMode(manualMode) {
  const patch = { treasury_manual_mode: Boolean(manualMode) }
  if (manualMode) {
    patch.treasury_auto_pool = false
    patch.treasury_auto_promote = false
  }
  return mergeGeneralSettings(patch)
}

/**
 * @param {object} entry
 */
/**
 * Удалить тестовые алерты из кольца treasury_ops_alerts (Stage 106.4b).
 * @param {(alert: object) => boolean} shouldRemove — true = удалить
 * @returns {Promise<{ removed: number, kept: number }>}
 */
export async function pruneTreasuryOpsAlerts(shouldRemove) {
  if (!supabaseAdmin) return { removed: 0, kept: 0 }
  const ops = await loadTreasuryOpsSettings()
  const prev = ops.recentAlerts || []
  const kept = prev.filter((a) => !shouldRemove(a))
  const removed = prev.length - kept.length
  if (removed > 0) {
    await mergeGeneralSettings({ treasury_ops_alerts: kept })
  }
  return { removed, kept: kept.length }
}

export async function appendTreasuryOpsAlert(entry) {
  if (!supabaseAdmin) return
  const ops = await loadTreasuryOpsSettings()
  const row = {
    id: entry.id || `ta-${Date.now().toString(36)}`,
    type: entry.type,
    severity: entry.severity || 'info',
    title: entry.title,
    detail: entry.detail || '',
    meta: entry.meta || {},
    at: entry.at || new Date().toISOString(),
    telegramSent: Boolean(entry.telegramSent),
  }
  const next = [row, ...(ops.recentAlerts || [])].slice(0, MAX_ALERTS_RING)
  await mergeGeneralSettings({ treasury_ops_alerts: next })
  return row
}
