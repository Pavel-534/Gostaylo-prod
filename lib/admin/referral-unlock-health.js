/**
 * Stage 121.3 — снимок для /admin/health: referral-unlock cron (held → wallet).
 */
import { supabaseAdmin } from '@/lib/supabase'

const JOB_NAME = 'referral-unlock'
const OPS_MISSING = "Could not find the table 'public.ops_job_runs'"

function sumUnlockStatsFromRuns(rows) {
  let unlockedCount = 0
  let unlockedAmountThb = 0
  let runCount = 0
  for (const row of rows || []) {
    if (String(row?.status || '').toLowerCase() !== 'success') continue
    runCount += 1
    const s = row?.stats && typeof row.stats === 'object' ? row.stats : {}
    unlockedCount += Number(s.unlockedCount) || 0
    unlockedAmountThb += Number(s.unlockedAmountThb) || 0
  }
  return {
    runCount,
    unlockedCount,
    unlockedAmountThb: Math.round(unlockedAmountThb * 100) / 100,
  }
}

/**
 * @param {string} sinceIso
 */
async function loadUnlockRunsSince(sinceIso) {
  const { data, error } = await supabaseAdmin
    .from('ops_job_runs')
    .select('status, started_at, stats')
    .eq('job_name', JOB_NAME)
    .gte('started_at', sinceIso)
    .order('started_at', { ascending: false })
    .limit(500)

  if (error) {
    if (String(error.message || '').includes(OPS_MISSING)) {
      return { rows: [], tablePresent: false, error: 'ops_job_runs table missing' }
    }
    return { rows: [], tablePresent: true, error: error.message }
  }
  return { rows: data || [], tablePresent: true, error: null }
}

export async function loadReferralUnlockHealth() {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const startOfUtcDay = new Date()
  startOfUtcDay.setUTCHours(0, 0, 0, 0)

  const out = {
    jobName: JOB_NAME,
    scheduleUtc: '15 5 * * *',
    tablePresent: true,
    lastRun: null,
    last24h: { unlockedCount: 0, unlockedAmountThb: 0, runCount: 0 },
    todayUtc: { unlockedCount: 0, unlockedAmountThb: 0, runCount: 0 },
    error: null,
  }

  const [daily24, dailyToday, lastRunRes] = await Promise.all([
    loadUnlockRunsSince(since24h),
    loadUnlockRunsSince(startOfUtcDay.toISOString()),
    supabaseAdmin
      .from('ops_job_runs')
      .select('id, status, started_at, finished_at, error_message, stats')
      .eq('job_name', JOB_NAME)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (!daily24.tablePresent) {
    out.tablePresent = false
    out.error = daily24.error
    return out
  }

  out.last24h = sumUnlockStatsFromRuns(daily24.rows)
  out.todayUtc = sumUnlockStatsFromRuns(dailyToday.rows)
  if (daily24.error) out.error = daily24.error

  if (lastRunRes.error) {
    if (!String(lastRunRes.error.message || '').includes(OPS_MISSING)) {
      out.error = out.error || lastRunRes.error.message
    }
  } else if (lastRunRes.data) {
    const stats =
      lastRunRes.data.stats && typeof lastRunRes.data.stats === 'object' ? lastRunRes.data.stats : null
    out.lastRun = {
      status: lastRunRes.data.status,
      startedAt: lastRunRes.data.started_at,
      finishedAt: lastRunRes.data.finished_at,
      errorMessage: lastRunRes.data.error_message,
      stats,
    }
  }

  return out
}

export default { loadReferralUnlockHealth }
