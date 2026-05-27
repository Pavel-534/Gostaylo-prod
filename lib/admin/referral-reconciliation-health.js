/**
 * Stage 119.2/119.3 — снимок для /admin/health + FinTech: referral-reconciliation cron.
 */
import { supabaseAdmin } from '@/lib/supabase'
import { sumReferralReconciliationFixedLast24h } from '@/lib/cron/referral-reconciliation-job.js'

const JOB_NAME = 'referral-reconciliation'
const OPS_MISSING = "Could not find the table 'public.ops_job_runs'"

export async function loadReferralReconciliationHealth() {
  const out = {
    jobName: JOB_NAME,
    scheduleUtc: '30 4 * * *',
    tablePresent: true,
    lastRun: null,
    fixedLast24h: 0,
    runCount24h: 0,
    fixedSince: null,
    error: null,
  }

  const daily = await sumReferralReconciliationFixedLast24h()
  out.fixedLast24h = Number(daily.fixed24h || 0)
  out.runCount24h = Number(daily.runCount24h || 0)
  out.fixedSince = daily.since || null
  if (daily.error) out.error = daily.error

  const { data, error } = await supabaseAdmin
    .from('ops_job_runs')
    .select('id, status, started_at, finished_at, error_message, stats')
    .eq('job_name', JOB_NAME)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    if (String(error.message || '').includes(OPS_MISSING)) {
      out.tablePresent = false
      out.error = out.error || 'ops_job_runs table missing'
      return out
    }
    out.error = out.error || error.message
    return out
  }

  if (data) {
    const stats = data.stats && typeof data.stats === 'object' ? data.stats : null
    out.lastRun = {
      status: data.status,
      startedAt: data.started_at,
      finishedAt: data.finished_at,
      errorMessage: data.error_message,
      stats,
      mismatches: Array.isArray(stats?.mismatches) ? stats.mismatches : [],
    }
  }

  return out
}

export default { loadReferralReconciliationHealth }
