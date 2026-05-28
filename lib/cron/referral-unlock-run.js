/**
 * Stage 121.3 — shared executor for referral-unlock cron (ops_job_runs observability).
 */
import { startOpsJobRun, finishOpsJobRun } from '@/lib/ops-job-runs'
import { runReferralUnlockJob } from '@/lib/cron/referral-unlock-job.js'

/**
 * @param {{ dryRun?: boolean, limit?: number, trigger?: string }} [options]
 */
export async function executeReferralUnlockRun(options = {}) {
  const trigger = String(options.trigger || 'referral_unlock')
  const run = await startOpsJobRun('referral-unlock')
  try {
    const result = await runReferralUnlockJob({
      dryRun: options.dryRun === true,
      limit: options.limit,
    })
    const stats = {
      ...result,
      trigger,
      manual: trigger === 'admin_manual',
    }
    await finishOpsJobRun(run, {
      status: result.success ? 'success' : 'error',
      stats,
      errorMessage: result.success ? null : result.error || (result.failureCount ? 'PARTIAL_UNLOCK_FAILURE' : null),
    })
    return { success: result.success !== false, run, result: stats }
  } catch (e) {
    await finishOpsJobRun(run, { status: 'error', errorMessage: e?.message })
    return { success: false, error: e?.message || String(e), run, result: null }
  }
}

export default { executeReferralUnlockRun }
