/**
 * POST /api/admin/smoke/financial-run — Stage 104 E2E financial smoke (ADMIN only).
 * Body: { rail?: 'TBANK_RU' | 'KG_CRYPTO', priceThb?, commissionRate?, guestPayCurrency?, skipCleanup? }
 */

import { NextResponse } from 'next/server'
import { requireAccess } from '@/lib/security/access-guard'
import { runFinancialSmoke } from '@/lib/smoke/financial-smoke-run.js'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(request) {
  const gate = await requireAccess({ roles: ['ADMIN'] })
  if (gate.error) return gate.error

  let body = {}
  try {
    body = await request.json().catch(() => ({}))
  } catch {
    body = {}
  }

  const result = await runFinancialSmoke({
    skipCleanup: body?.skipCleanup === true,
    rail: body?.rail,
    priceThb: body?.priceThb,
    commissionRate: body?.commissionRate,
    guestPayCurrency: body?.guestPayCurrency,
  })

  return NextResponse.json({
    success: result.ok,
    data: result,
  })
}
