/**
 * Stage 114.6 — массовые hold/release по фильтру referral_ledger.
 */
import { supabaseAdmin } from '@/lib/supabase'
import { buildReferralLedgerQuery } from '@/lib/admin/referral-ledger-query.js'
import { applyReferralLedgerAdminAction } from '@/lib/admin/referral-ledger-admin.js'

/**
 * @param {{
 *   action: 'hold_all_pending' | 'release_all_held',
 *   periodFrom?: string,
 *   periodTo?: string,
 *   type?: string,
 *   adminUserId?: string,
 *   limit?: number,
 * }} input
 */
export async function applyReferralLedgerBulkAction(input = {}) {
  const action = String(input?.action || '').trim().toLowerCase()
  if (!['hold_all_pending', 'release_all_held'].includes(action)) {
    return { success: false, error: 'INVALID_BULK_ACTION' }
  }

  const limit = Math.min(500, Math.max(1, Number(input.limit) || 200))
  const { data: rows, error } = await buildReferralLedgerQuery({
    status: 'pending',
    type: input.type || 'all',
    dateFrom: input.periodFrom || '',
    dateTo: input.periodTo || '',
    limit,
  })
  if (error) return { success: false, error: error.message || 'LEDGER_BULK_READ_FAILED' }

  const targets = (rows || []).filter((row) => {
    const held = row?.metadata?.admin_hold === true
    if (action === 'hold_all_pending') return !held
    return held
  })

  if (!targets.length) {
    return { success: true, processed: 0, skipped: 0, action }
  }

  let processed = 0
  const failures = []
  const rowAction = action === 'hold_all_pending' ? 'hold' : 'release_hold'

  for (const row of targets) {
    const res = await applyReferralLedgerAdminAction(String(row.id), {
      action: rowAction,
      adminUserId: input.adminUserId,
      note: `bulk_${action}`,
    })
    if (res?.success) processed += 1
    else failures.push({ ledgerId: row.id, error: res?.error || 'FAILED' })
  }

  return {
    success: processed > 0 || failures.length === 0,
    action,
    processed,
    failureCount: failures.length,
    failures: failures.length ? failures.slice(0, 10) : undefined,
  }
}
