/**
 * Stage 142 — safe aggregation of ops_job_runs for /admin/health (never throws on bad rows).
 */

const DEFAULT_ERROR_PREVIEW_LEN = 160
const MAX_ERROR_FULL_LEN = 4000

/** @param {unknown} msg */
export function sanitizeOpsErrorMessage(msg, maxLen = MAX_ERROR_FULL_LEN) {
  if (msg == null) return null
  let s = String(msg)
    .replace(/\0/g, '')
    .replace(/\r\n/g, '\n')
  if (s.length > maxLen) {
    s = `${s.slice(0, maxLen)}\n… [truncated ${s.length - maxLen} chars]`
  }
  return s
}

/** @param {unknown} msg */
export function opsErrorPreview(msg, maxLen = DEFAULT_ERROR_PREVIEW_LEN) {
  const full = sanitizeOpsErrorMessage(msg, maxLen)
  if (!full) return null
  return full.length > maxLen ? `${full.slice(0, maxLen)}…` : full
}

/** @param {unknown} stats */
function safeStatsObject(stats) {
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) return {}
  try {
    return JSON.parse(JSON.stringify(stats))
  } catch {
    return {}
  }
}

/** @param {unknown} row */
export function sanitizeOpsJobRow(row) {
  if (!row || typeof row !== 'object') return null
  const r = /** @type {Record<string, unknown>} */ (row)
  return {
    job_name: r.job_name != null ? String(r.job_name) : '',
    status: r.status != null ? String(r.status) : null,
    started_at: r.started_at != null ? String(r.started_at) : null,
    finished_at: r.finished_at != null ? String(r.finished_at) : null,
    stats: safeStatsObject(r.stats),
    error_message: sanitizeOpsErrorMessage(r.error_message),
    error_preview: opsErrorPreview(r.error_message),
  }
}

/** @param {unknown[]} rows */
export function sanitizeOpsJobRows(rows) {
  if (!Array.isArray(rows)) return []
  return rows.map(sanitizeOpsJobRow).filter(Boolean)
}

/**
 * @param {ReturnType<typeof sanitizeOpsJobRow>[]} rows
 * @param {string} jobName
 */
function pickLatestRuns(rows, jobName) {
  const list = rows.filter((r) => r?.job_name === jobName)
  list.sort((a, b) => new Date(b?.started_at || 0) - new Date(a?.started_at || 0))
  return list
}

/**
 * @param {ReturnType<typeof sanitizeOpsJobRow>[]} rows
 * @param {string} jobName
 */
export function aggregateOpsJob(rows, jobName) {
  try {
    const runs = pickLatestRuns(rows, jobName)
    const last = runs[0] || null
    let successRuns = 0
    let errorRuns = 0
    let sumDelivered = 0
    let sumStuckFound = 0
    let sumRemoved = 0
    let sumProbed = 0
    let sumSynced = 0
    let sumIcalErrors = 0
    let sumTotal = 0

    for (const r of runs) {
      if (r.status === 'success') successRuns += 1
      else if (r.status === 'error') errorRuns += 1
      const s = r.stats && typeof r.stats === 'object' ? r.stats : {}
      if (jobName === 'push-sweeper') {
        sumDelivered += Number(s.delivered || 0)
        sumStuckFound += Number(s.stuck_found || 0)
      }
      if (jobName === 'push-token-hygiene') {
        sumRemoved += Number(s.removed || 0)
        sumProbed += Number(s.probed || 0)
      }
      if (jobName === 'ical-sync') {
        sumSynced += Number(s.synced || 0)
        sumIcalErrors += Number(s.errors || 0)
        sumTotal += Number(s.total || 0)
      }
      if (jobName === 'partner-sla-telegram-nudge') {
        sumDelivered += Number(s.sent || 0)
        sumStuckFound += Number(s.scanned || 0)
        sumRemoved += Number(s.skipped || 0)
        sumProbed += Number(s.errors || 0)
      }
      if (jobName === 'referral-reconciliation') {
        sumDelivered += Number(s.mismatchBookingCount || 0)
        sumStuckFound += Number(s.mismatchLedgerRows || 0)
        sumRemoved += Number(s.revertedBookingCount || 0)
      }
      if (jobName === 'referral-unlock') {
        sumDelivered += Number(s.unlockedCount || 0)
        sumStuckFound += Number(s.bookingCount || 0)
        sumRemoved += Number(s.unlockedAmountThb || 0)
      }
    }

    return {
      jobName,
      runCount: runs.length,
      successRuns,
      errorRuns,
      lastStatus: last?.status || null,
      lastStartedAt: last?.started_at || null,
      lastFinishedAt: last?.finished_at || null,
      lastErrorMessage: last?.error_message || null,
      lastErrorPreview: last?.error_preview || null,
      totals:
        jobName === 'push-sweeper'
          ? { delivered: sumDelivered, stuck_found: sumStuckFound }
          : jobName === 'push-token-hygiene'
            ? { removed: sumRemoved, probed: sumProbed }
            : jobName === 'ical-sync'
              ? { synced: sumSynced, errors: sumIcalErrors, listings_considered: sumTotal }
              : jobName === 'partner-sla-telegram-nudge'
                ? {
                    sent: sumDelivered,
                    scanned: sumStuckFound,
                    skipped: sumRemoved,
                    errors: sumProbed,
                  }
                : jobName === 'referral-reconciliation'
                  ? {
                      mismatch_bookings: sumDelivered,
                      mismatch_ledger_rows: sumStuckFound,
                      reverted_bookings: sumRemoved,
                    }
                  : jobName === 'referral-unlock'
                    ? {
                        unlocked_rows: sumDelivered,
                        bookings_processed: sumStuckFound,
                        unlocked_amount_thb: sumRemoved,
                      }
                    : {},
    }
  } catch (e) {
    return {
      jobName,
      runCount: 0,
      successRuns: 0,
      errorRuns: 0,
      lastStatus: null,
      lastStartedAt: null,
      lastFinishedAt: null,
      lastErrorMessage: sanitizeOpsErrorMessage(e?.message || 'aggregate failed'),
      lastErrorPreview: opsErrorPreview(e?.message || 'aggregate failed'),
      totals: {},
      aggregateError: true,
    }
  }
}

export const OPS_HEALTH_JOB_NAMES = [
  'ical-sync',
  'push-sweeper',
  'push-token-hygiene',
  'partner-sla-telegram-nudge',
  'referral-reconciliation',
  'referral-unlock',
]

/**
 * Recent failed/running-with-error runs for expandable UI.
 * @param {ReturnType<typeof sanitizeOpsJobRow>[]} rows
 * @param {{ limit?: number, sinceIso?: string }} [opts]
 */
export function collectRecentJobFailures(rows, opts = {}) {
  const limit = Math.min(Math.max(1, Number(opts.limit) || 24), 50)
  const sinceMs = opts.sinceIso ? new Date(opts.sinceIso).getTime() : 0
  const failures = rows.filter((r) => {
    if (!r?.job_name) return false
    if (sinceMs && Number.isFinite(sinceMs)) {
      const t = new Date(r.started_at || 0).getTime()
      if (!Number.isFinite(t) || t < sinceMs) return false
    }
    return r.status === 'error' || Boolean(r.error_message)
  })
  failures.sort((a, b) => new Date(b?.started_at || 0) - new Date(a?.started_at || 0))
  return failures.slice(0, limit).map((r) => ({
    jobName: r.job_name,
    status: r.status,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    errorPreview: r.error_preview,
    errorMessage: r.error_message,
  }))
}

/**
 * @param {ReturnType<typeof sanitizeOpsJobRow>[]} rows
 */
export function buildOpsJobsMap(rows) {
  return Object.fromEntries(OPS_HEALTH_JOB_NAMES.map((name) => [name, aggregateOpsJob(rows, name)]))
}
