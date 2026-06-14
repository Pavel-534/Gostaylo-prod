/**
 * Stage 119.3 — shared executor for cron + admin manual referral reconciliation.
 */
import { startOpsJobRun, finishOpsJobRun } from '@/lib/ops-job-runs'
import { runReferralReconciliationJob } from '@/lib/cron/referral-reconciliation-job.js'
import WalletService from '@/lib/services/finance/wallet.service.js'

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

    let expiredWithdrawalSweep = { scanned: 0, cleared: 0, errors: [] }
    if (result.success !== false && options.dryRun !== true) {
      expiredWithdrawalSweep = await WalletService.clearAllExpiredReferralWithdrawals()
    }

    const stats = {
      ...result,
      trigger,
      manual: trigger === 'admin_manual',
      expiredWithdrawalsScanned: expiredWithdrawalSweep.scanned,
      expiredWithdrawalsCleared: expiredWithdrawalSweep.cleared,
      expiredWithdrawalErrors: expiredWithdrawalSweep.errors?.length
        ? expiredWithdrawalSweep.errors.slice(0, 10)
        : [],
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
