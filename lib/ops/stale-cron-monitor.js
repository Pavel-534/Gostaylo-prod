/**
 * AUDIT_MONEY_FLOW_04 P1 — proactive stale cron watcher.
 * Looks only at ops_job_runs.status = 'success'.
 * Does not mutate money paths; safe to call from financial-health + hourly money crons.
 *
 * Stage 202.11 — per-job last-success query (shared limit missed daily jobs under 10m traffic);
 * durable TG de-dupe via critical_signal_events (serverless in-memory Map was useless).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { recordCriticalSignal } from '@/lib/critical-telemetry.js'
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js'

const HOUR_MS = 60 * 60 * 1000
const OPS_MISSING = "Could not find the table 'public.ops_job_runs'"
const SIGNALS_MISSING = "Could not find the table 'public.critical_signal_events'"
/** Same as LEDGER_SHADOW_JOB_NAME — inline to avoid heavy import graph in unit tests. */
const LEDGER_SHADOW_JOB_NAME = 'ledger_shadow_reconcile'

/** In-process TG de-dupe per job (same isolate only; DB de-dupe is authoritative). */
const staleTgLastSentAt = new Map()

/**
 * @param {string} jobName
 * @param {number} windowMs
 */
function shouldSendStaleCronTelegram(jobName, windowMs) {
  const now = Date.now()
  const last = staleTgLastSentAt.get(jobName) || 0
  if (now - last < windowMs) return false
  staleTgLastSentAt.set(jobName, now)
  return true
}

/** @internal tests */
export function resetStaleCronTelegramDedupeForTests() {
  staleTgLastSentAt.clear()
}

/** @typedef {'hourly' | 'daily'} StaleCronCadence */

/**
 * @typedef {{
 *   jobName: string
 *   cadence: StaleCronCadence
 *   maxAgeMs: number
 * }} StaleCronWatchEntry
 */

/** Watchlist from ops TZ (promote-to-ready → promote-ready-for-payout). */
export const STALE_CRON_WATCHLIST = Object.freeze([
  {
    jobName: 'reconcile-confirmed-payments',
    cadence: 'hourly',
    maxAgeMs: 2 * HOUR_MS,
  },
  {
    jobName: 'reconcile-yookassa-pending',
    cadence: 'hourly',
    /** External every 10 min; alert if no success for ~45m (3 missed windows). */
    maxAgeMs: 45 * 60 * 1000,
  },
  {
    jobName: 'escrow-thaw',
    cadence: 'hourly',
    maxAgeMs: 2 * HOUR_MS,
  },
  {
    jobName: 'promote-ready-for-payout',
    cadence: 'hourly',
    maxAgeMs: 2 * HOUR_MS,
  },
  {
    jobName: LEDGER_SHADOW_JOB_NAME,
    cadence: 'daily',
    maxAgeMs: 26 * HOUR_MS,
  },
])

/**
 * @param {string | null | undefined} iso
 * @param {number} nowMs
 * @param {number} maxAgeMs
 */
export function isOpsSuccessStale(iso, nowMs, maxAgeMs) {
  if (!iso) return true
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return true
  return nowMs - t > maxAgeMs
}

/**
 * From a mixed success feed (newest-first), keep first hit per job.
 * @param {Array<{ job_name?: string, started_at?: string, finished_at?: string }>} rows
 * @param {string[]} jobNames
 * @returns {Map<string, string | null>}
 */
export function pickLatestSuccessAtByJob(rows, jobNames) {
  /** @type {Map<string, string | null>} */
  const out = new Map(jobNames.map((n) => [n, null]))
  for (const row of rows || []) {
    const name = String(row?.job_name || '')
    if (!name || !out.has(name) || out.get(name)) continue
    out.set(name, row.finished_at || row.started_at || null)
  }
  return out
}

/**
 * Latest finished_at (or started_at) per job among status=success rows.
 * One query per job (limit 1) — a shared `.limit(80)` across jobs missed daily
 * `ledger_shadow_reconcile` under heavy 10m yookassa / hourly traffic (Stage 202.11).
 * @param {string[]} jobNames
 * @returns {Promise<Map<string, string | null>>}
 */
export async function loadLastSuccessAtByJob(jobNames) {
  /** @type {Map<string, string | null>} */
  const out = new Map(jobNames.map((n) => [n, null]))
  if (!supabaseAdmin || !jobNames.length) return out

  await Promise.all(
    jobNames.map(async (name) => {
      const { data, error } = await supabaseAdmin
        .from('ops_job_runs')
        .select('job_name, started_at, finished_at')
        .eq('job_name', name)
        .eq('status', 'success')
        .order('started_at', { ascending: false })
        .limit(1)

      if (error) {
        if (!String(error.message || '').includes(OPS_MISSING)) {
          console.warn('[stale-cron-monitor] ops_job_runs query:', name, error.message)
        }
        return
      }
      const row = Array.isArray(data) ? data[0] : data
      if (row) {
        out.set(name, row.finished_at || row.started_at || null)
      }
    }),
  )

  return out
}

/**
 * Durable TG de-dupe across serverless isolates.
 * @param {string} jobName
 * @param {number} windowMs
 */
async function hasRecentStaleCronTelegram(jobName, windowMs) {
  if (!supabaseAdmin || !jobName) return false
  const sinceIso = new Date(Date.now() - windowMs).toISOString()
  try {
    const { data, error } = await supabaseAdmin
      .from('critical_signal_events')
      .select('detail, created_at')
      .eq('signal_key', 'STALE_CRON')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(80)

    if (error) {
      if (!String(error.message || '').includes(SIGNALS_MISSING)) {
        console.warn('[stale-cron-monitor] critical_signal_events:', error.message)
      }
      return false
    }

    return (data || []).some(
      (row) =>
        row?.detail &&
        typeof row.detail === 'object' &&
        String(row.detail.jobName || '') === jobName &&
        row.detail.tgNotified === true,
    )
  } catch {
    return false
  }
}

/**
 * @param {{ nowMs?: number, watchlist?: StaleCronWatchEntry[], alert?: boolean }} [opts]
 * @returns {Promise<{ checked: number, stale: Array<object>, alertsSent: string[], error?: string }>}
 */
export async function runStaleCronMonitor(opts = {}) {
  const nowMs = Number.isFinite(opts.nowMs) ? opts.nowMs : Date.now()
  const watchlist = Array.isArray(opts.watchlist) ? opts.watchlist : STALE_CRON_WATCHLIST
  const alert = opts.alert !== false
  const alertsSent = []

  if (!supabaseAdmin) {
    return { checked: 0, stale: [], alertsSent, error: 'no_db' }
  }

  const lastByJob = await loadLastSuccessAtByJob(watchlist.map((w) => w.jobName))
  const stale = []

  for (const entry of watchlist) {
    const lastSuccessAt = lastByJob.get(entry.jobName) || null
    if (!isOpsSuccessStale(lastSuccessAt, nowMs, entry.maxAgeMs)) continue

    const ageMs = lastSuccessAt ? nowMs - new Date(lastSuccessAt).getTime() : null
    const ageHours = ageMs != null && Number.isFinite(ageMs) ? ageMs / HOUR_MS : null
    const item = {
      jobName: entry.jobName,
      cadence: entry.cadence,
      maxAgeHours: entry.maxAgeMs / HOUR_MS,
      lastSuccessAt,
      ageHours,
    }
    stale.push(item)

    if (!alert) continue

    const ageLabel =
      ageHours != null ? `${Math.round(ageHours * 10) / 10}h ago` : 'never'
    const line = `[STALE_CRON] ${entry.jobName}`
    const tgWindowMs = Math.max(entry.maxAgeMs, 2 * HOUR_MS)

    // Persist always (ops history); TG separately with durable de-dupe.
    recordCriticalSignal('STALE_CRON', {
      severity: 'WARN',
      tag: '[OPS]',
      threshold: Number.MAX_SAFE_INTEGER,
      windowMs: 2 * HOUR_MS,
      detailLines: [
        line,
        `cadence=${entry.cadence}`,
        `maxAgeHours=${entry.maxAgeMs / HOUR_MS}`,
        `lastSuccess=${lastSuccessAt || 'none'}`,
        `age=${ageLabel}`,
      ],
      persistDetail: {
        jobName: entry.jobName,
        cadence: entry.cadence,
        lastSuccessAt,
        ageHours,
      },
    })

    if (!shouldSendStaleCronTelegram(entry.jobName, tgWindowMs)) continue
    if (await hasRecentStaleCronTelegram(entry.jobName, tgWindowMs)) continue

    try {
      await notifySystemAlert(
        `${escapeSystemAlertHtml(line)}\n` +
          `cadence=${escapeSystemAlertHtml(entry.cadence)} last_success=${escapeSystemAlertHtml(ageLabel)}`,
      )
      recordCriticalSignal('STALE_CRON', {
        severity: 'WARN',
        tag: '[OPS]',
        threshold: Number.MAX_SAFE_INTEGER,
        windowMs: 2 * HOUR_MS,
        detailLines: [`${line} tg_notified`],
        persistDetail: {
          jobName: entry.jobName,
          cadence: entry.cadence,
          lastSuccessAt,
          ageHours,
          tgNotified: true,
        },
      })
      alertsSent.push(entry.jobName)
    } catch {
      /* non-fatal */
    }
  }

  return { checked: watchlist.length, stale, alertsSent }
}
