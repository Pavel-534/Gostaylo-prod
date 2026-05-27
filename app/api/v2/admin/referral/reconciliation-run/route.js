/**
 * POST /api/v2/admin/referral/reconciliation-run
 * Stage 119.3 — ручной запуск referral reconciliation (System Health / FinTech).
 */
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { executeReferralReconciliationRun } from '@/lib/cron/referral-reconciliation-run.js'

export async function POST(request) {
  const access = await requireAdminStaff(request)
  if (access.error) return access.error

  let body = {}
  try {
    body = await request.json().catch(() => ({}))
  } catch {
    body = {}
  }

  const dryRun = body?.dryRun === true
  const limit = body?.limit != null ? Number(body.limit) : undefined

  const exec = await executeReferralReconciliationRun({
    dryRun,
    limit,
    trigger: 'admin_manual',
  })

  if (!exec.success) {
    return NextResponse.json(
      { success: false, error: exec.error || exec.result?.error || 'RECONCILIATION_FAILED', ...exec.result },
      { status: 500 },
    )
  }

  return NextResponse.json({
    success: true,
    data: exec.result,
  })
}
