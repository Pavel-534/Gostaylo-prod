/**
 * POST /api/admin/finances/prepare-pause
 * Stage 106.3 — smoke + legal ZIP + PDF-памятка + Emergency Pause → один архив.
 */

import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { runOwnerPreparePauseWorkflow } from '@/lib/owner/owner-pause-toolkit.js'
import {
  recordTreasuryOpsAlert,
  TREASURY_ALERT_TYPES,
} from '@/lib/treasury/treasury-monitoring-alerts.js'

export const dynamic = 'force-dynamic'
export const maxDuration = 180

export async function POST(request) {
  const gate = await requireAdminStaff(request)
  if (gate.error) return gate.error

  let body = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  if (!body.confirm) {
    return NextResponse.json(
      {
        success: false,
        error: 'Нужно подтверждение (confirm: true)',
        code: 'CONFIRM_REQUIRED',
      },
      { status: 400 },
    )
  }

  const result = await runOwnerPreparePauseWorkflow({
    reason: body.reason,
    pausedBy: gate.profile?.id || null,
    enablePause: body.enablePause !== false,
  })

  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        error: result.error,
        data: { smoke: result.smoke, readiness: result.readiness },
      },
      { status: 500 },
    )
  }

  await recordTreasuryOpsAlert({
    type: TREASURY_ALERT_TYPES.EMERGENCY_PAUSE,
    severity: 'critical',
    title: 'Подготовка к паузе владельца',
    detail: result.pauseReason,
    meta: { pausedBy: gate.profile?.id, smokeOk: result.smoke?.ok },
    telegramHtml:
      `🛑 <b>Платформа на паузе</b>\n\n` +
      `Владелец подготовил систему к перерыву.\n` +
      `Smoke: ${result.smoke?.ok ? 'OK' : 'есть ошибки'}\n` +
      `${result.pauseReason ? `Причина: ${result.pauseReason}` : ''}`,
  })

  return new NextResponse(result.buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${result.filename}"`,
      'Cache-Control': 'no-store',
      'X-Smoke-Ok': result.smoke?.ok ? '1' : '0',
      'X-Pause-Enabled': '1',
    },
  })
}
