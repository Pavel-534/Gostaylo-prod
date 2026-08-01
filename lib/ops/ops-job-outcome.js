/**
 * AUDIT_MONEY_FLOW_04 P1 — map cron result → ops_job_runs status.
 *
 * Convention (platform-wide): success | error | running
 * ("FAILED" in ops TZ = status `error` — same as admin health / ADR-203 streak queries.)
 *
 * Soft empty work → success. DB / freeze / hard failure → error.
 */

/** Soft skips for payout-batch-pools (empty day / wrong calendar day / already batched). */
export const PAYOUT_POOL_SOFT_SKIP_ERRORS = Object.freeze(
  new Set(['not_pool_day', 'no_ready_bookings', 'all_already_batched']),
)

/**
 * @param {{ success?: boolean, error?: string | null, processed?: number, message?: string } | null | undefined} result
 * @returns {{ status: 'success' | 'error', errorMessage: string | null, stats: object }}
 */
export function resolveEscrowThawOps(result) {
  const processed = Number(result?.processed || 0)
  const stats = {
    processed,
    ...(result?.message ? { message: result.message } : {}),
    ...(result?.error ? { result_error: result.error } : {}),
  }
  if (result?.success === false || result?.error) {
    return {
      status: 'error',
      errorMessage: String(result.error || result.message || 'escrow_thaw_failed'),
      stats,
    }
  }
  return { status: 'success', errorMessage: null, stats }
}

/**
 * @param {{ error?: string | null, message?: string | null, batchId?: string | null, itemCount?: number } | null | undefined} result
 * @returns {{ status: 'success' | 'error', errorMessage: string | null, stats: object }}
 */
export function resolvePayoutBatchPoolsOps(result) {
  const stats =
    result && typeof result === 'object'
      ? {
          batchId: result.batchId ?? null,
          itemCount: Number(result.itemCount || 0),
          message: result.message || null,
          rail: result.rail || null,
          ...(result.error ? { result_error: result.error } : {}),
        }
      : {}

  const code = result?.error ? String(result.error) : ''
  if (!code) {
    return { status: 'success', errorMessage: null, stats }
  }
  if (PAYOUT_POOL_SOFT_SKIP_ERRORS.has(code) || result?.message === 'no_ready_bookings') {
    return {
      status: 'success',
      errorMessage: null,
      stats: { ...stats, soft_skip: code || result.message },
    }
  }
  return {
    status: 'error',
    errorMessage: String(result.message || code),
    stats,
  }
}

/**
 * Empty partner set / zero drift → success.
 * Partner compare failures (errors > 0) → error (soft fail ≠ green ops).
 * Drift alone stays success (business alert [LEDGER_DRIFT], job still ran).
 *
 * @param {{ compared?: number, errors?: number, driftCount?: number, zeroDrift?: boolean, toleranceThb?: number } | null | undefined} result
 * @returns {{ status: 'success' | 'error', errorMessage: string | null, stats: object }}
 */
export function resolveLedgerShadowOps(result) {
  const errors = Number(result?.errors || 0)
  const stats = {
    compared: Number(result?.compared || 0),
    errors,
    driftCount: Number(result?.driftCount || 0),
    zeroDrift: Boolean(result?.zeroDrift),
    toleranceThb: result?.toleranceThb,
  }
  if (errors > 0) {
    return {
      status: 'error',
      errorMessage: `ledger_shadow_compare_errors=${errors}`,
      stats,
    }
  }
  return { status: 'success', errorMessage: null, stats }
}
