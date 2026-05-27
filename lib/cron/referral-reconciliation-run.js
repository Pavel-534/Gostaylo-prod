/**
 * Stage 119.3 — shared executor for cron + admin manual referral reconciliation.
 */
import { startOpsJobRun, finishOpsJobRun } from '@/lib/ops-job-runs'
import { runReferralReconciliationJob } from '@/lib/cron/referral-reconciliation-job.js'

/**
 * @param {{ dryRun?: boolean, limit?: number, trigger?: string }} [options]
 */
export async function executeReferralReconciliationRun(options = {}) {
  const trigger = String(options.trigger || 'referral_reconciliation')
  const run = await startOpsJobRun('referral-reconciliation')
  try {
    const result = await runReferralReconciliationJob({
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
      errorMessage: result.success ? null : result.error,
    })
    return { success: result.success !== false, run, result: stats }
  } catch (e) {
    await finishOpsJobRun(run, { status: 'error', errorMessage: e?.message })
    return { success: false, error: e?.message || String(e), run, result: null }
  }
}

export default { executeReferralReconciliationRun }
