/**
 * Stage 108.3 — P0-4: видимость financial cron в FinTech-пульте (ops_job_runs).
 */

import { supabaseAdmin } from '@/lib/supabase'
import {
  recordTreasuryOpsAlert,
  TREASURY_ALERT_TYPES,
} from '@/lib/treasury/treasury-monitoring-alerts.js'

/** @type {readonly { jobName: string, label: string, labelOwner: string, staleHours: number }[]} */
export const FINANCIAL_CRON_HEALTH_JOBS = Object.freeze([
  {
    jobName: 'escrow-thaw',
    label: 'Разморозка эскроу (escrow-thaw)',
    labelOwner: 'Разморозка денег после оплаты',
    staleHours: 3,
  },
  {
    jobName: 'promote-ready-for-payout',
    label: 'Готовность к выплате (promote-ready-for-payout)',
    labelOwner: 'Подготовка сумм к выплате партнёрам',
    staleHours: 3,
  },
])

const OPS_MISSING = "Could not find the table 'public.ops_job_runs'"

/**
 * @param {string | null | undefined} iso
 * @param {number} staleHours
 */
export function classifyCronFreshness(iso, staleHours = 3) {
  if (!iso) {
    return { status: 'missing', stale: true, ageMs: null, ageHours: null }
  }
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) {
    return { status: 'missing', stale: true, ageMs: null, ageHours: null }
  }
  const ageMs = Date.now() - t
  const ageHours = ageMs / (60 * 60 * 1000)
  const stale = ageHours > staleHours
  if (stale) return { status: 'stale', stale: true, ageMs, ageHours }
  return { status: 'ok', stale: false, ageMs, ageHours }
}

/**
 * @param {boolean} [ownerLabels]
 */
export async function loadFinancialCronHealth(ownerLabels = false) {
  if (!supabaseAdmin) {
    return { jobs: [], opsTableMissing: true }
  }

  const names = FINANCIAL_CRON_HEALTH_JOBS.map((j) => j.jobName)
  const { data, error } = await supabaseAdmin
    .from('ops_job_runs')
    .select('job_name,status,started_at,finished_at,error_message')
    .in('job_name', names)
    .order('started_at', { ascending: false })
    .limit(80)

  if (error) {
    if (String(error.message || '').includes(OPS_MISSING)) {
      return { jobs: [], opsTableMissing: true }
    }
    return { jobs: [], opsTableMissing: false, loadError: error.message }
  }

  const rows = Array.isArray(data) ? data : []
  const byJob = new Map()
  for (const row of rows) {
    const key = row.job_name
    if (!byJob.has(key)) byJob.set(key, row)
  }

  const jobs = FINANCIAL_CRON_HEALTH_JOBS.map((def) => {
    const last = byJob.get(def.jobName) || null
    const lastAt = last?.finished_at || last?.started_at || null
    const fresh = classifyCronFreshness(lastAt, def.staleHours)
    return {
      jobName: def.jobName,
      label: ownerLabels ? def.labelOwner : def.label,
      labelOwner: def.labelOwner,
      lastStatus: last?.status || null,
      lastStartedAt: last?.started_at || null,
      lastFinishedAt: last?.finished_at || null,
      lastErrorMessage: last?.error_message || null,
      ...fresh,
    }
  })

  return { jobs, opsTableMissing: false }
}

/**
 * TG FINANCE при открытии пульта, если cron давно не бегал (cooldown в recordTreasuryOpsAlert).
 * @param {Awaited<ReturnType<typeof loadFinancialCronHealth>>['jobs']} jobs
 */
export async function maybeAlertStaleFinancialCrons(jobs) {
  const staleJobs = (jobs || []).filter((j) => j.stale)
  if (!staleJobs.length) return

  for (const j of staleJobs) {
    const age =
      j.ageHours != null
        ? `${Math.round(j.ageHours * 10) / 10} ч назад`
        : 'нет записей'
    await recordTreasuryOpsAlert({
      type: TREASURY_ALERT_TYPES.CRON_STALE,
      severity: j.status === 'missing' ? 'critical' : 'warn',
      title: `Cron не запускался: ${j.label}`,
      detail: `Последний успешный прогон: ${age}. Проверьте cron-job.org / Vercel.`,
      meta: { jobName: j.jobName, lastFinishedAt: j.lastFinishedAt },
      telegramHtml:
        `<b>⚠️ Финансовый cron</b>\n` +
        `<b>${j.label}</b>\n` +
        `Последний запуск: ${age}\n` +
        `Проверьте внешний планировщик (см. docs/CRON_EXTERNAL_FINANCIAL.md).`,
    }).catch(() => {})
  }
}
