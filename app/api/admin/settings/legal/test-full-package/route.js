/**
 * POST /api/admin/settings/legal/test-full-package
 * Полный финансовый smoke из админки (Stage 103).
 */

import { NextResponse } from 'next/server'
import { requireAccess } from '@/lib/security/access-guard'
import { runFinancialSmoke } from '@/lib/smoke/financial-smoke-run.js'
import { saveOwnerSmokeSnapshot } from '@/lib/owner/owner-pause-toolkit.js'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(request) {
  const gate = await requireAccess({ roles: ['ADMIN'] })
  if (gate.error) return gate.error

  let body = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const result = await runFinancialSmoke({
    skipCleanup: false,
    rail: body.rail,
    priceThb: body.priceThb,
    commissionRate: body.commissionRate,
    guestPayCurrency: body.guestPayCurrency,
  })

  await saveOwnerSmokeSnapshot({
    ok: result.ok,
    steps: result.steps,
    message: result.message,
    ranAt: new Date().toISOString(),
  })

  return NextResponse.json({
    success: result.ok,
    data: {
      ...result,
      message: result.ok
        ? 'Полный тестовый пакет сформирован: цепочка от регистрации до ZIP и актов в кабинете партнёра.'
        : 'Тест не пройден — см. шаги с ошибкой.',
    },
  })
}
