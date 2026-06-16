/**
 * GET / PATCH — Stage 105 treasury ops (manual mode, emergency pause).
 */

import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import {
  loadTreasuryOpsSettings,
  setTreasuryEmergencyPause,
  setTreasuryManualMode,
} from '@/lib/treasury/treasury-ops-config.js'
import {
  runTreasuryMonitoringScan,
  recordTreasuryOpsAlert,
  TREASURY_ALERT_TYPES,
} from '@/lib/treasury/treasury-monitoring-alerts.js'
import { loadProductionPaymentReadiness } from '@/lib/payment/production-readiness.js'
import { loadPreLiveReadiness } from '@/lib/payment/pre-live-readiness.js'
import { activateControlledLive } from '@/lib/treasury/controlled-live.js'
import { loadLiveMonitoringMetrics } from '@/lib/treasury/live-monitoring-metrics.js'
import {
  loadFinancialCronHealth,
  maybeAlertStaleFinancialCrons,
} from '@/lib/admin/financial-cron-health.js'
import { loadReferralReconciliationHealth } from '@/lib/admin/referral-reconciliation-health.js'
import { loadYookassaOpsStatus } from '@/lib/payment/yookassa-ops-status.js'
import { recordAdminAudit } from '@/lib/services/audit/admin-audit.js'
import { normalizeAdminRole } from '@/lib/admin/admin-menu'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const gate = await requireAdminStaff(request)
  if (gate.error) return gate.error

  const scan = await runTreasuryMonitoringScan()
  const productionReadiness = await loadProductionPaymentReadiness()
  const cronHealth = await loadFinancialCronHealth(false)
  const preLiveReadiness = await loadPreLiveReadiness({
    productionReadiness,
    cronHealth,
    scan,
  })
  const liveMonitoring = await loadLiveMonitoringMetrics({
    driftThb: scan.driftThb,
    pendingFiscalCount: scan.pendingFiscalCount,
  })
  const referralReconciliation = await loadReferralReconciliationHealth()
  const yookassaOps = await loadYookassaOpsStatus()
  await maybeAlertStaleFinancialCrons(cronHealth.jobs)

  return NextResponse.json({
    success: true,
    data: {
      ops: scan.ops,
      productionReadiness,
      yookassaOps,
      preLiveReadiness,
      liveMonitoring,
      cronHealth,
      referralReconciliation,
      thresholds: scan.thresholds,
      driftThb: scan.driftThb,
      pendingFiscalCount: scan.pendingFiscalCount,
      railsSummary: scan.railsSummary,
      recentAlerts: scan.recentAlerts,
      env: {
        TREASURY_MANUAL_MODE: process.env.TREASURY_MANUAL_MODE ?? '(default true)',
        TREASURY_AUTO_POOL: process.env.TREASURY_AUTO_POOL ?? '0',
        TREASURY_AUTO_PROMOTE: process.env.TREASURY_AUTO_PROMOTE ?? '0',
      },
    },
  })
}

export async function PATCH(request) {
  const gate = await requireAdminStaff(request)
  if (gate.error) return gate.error

  const actorRole = normalizeAdminRole(gate.profile?.role) || 'ADMIN'
  const actorId = gate.profile?.id || null

  let body = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  if (body.emergencyPause !== undefined) {
    const active = Boolean(body.emergencyPause)
    const r = await setTreasuryEmergencyPause({
      active,
      reason: body.reason,
      pausedBy: actorId,
    })
    if (!r.success) {
      return NextResponse.json({ success: false, error: r.error }, { status: 500 })
    }
    if (active) {
      await recordTreasuryOpsAlert({
        type: TREASURY_ALERT_TYPES.EMERGENCY_PAUSE,
        severity: 'critical',
        title: 'Emergency Pause включён',
        detail: body.reason || 'Владелец остановил брони и выплаты',
        meta: { pausedBy: actorId },
        telegramHtml:
          `🛑 <b>Emergency Pause</b>\n\n` +
          `Новые бронирования и выплаты <b>заблокированы</b>.\n` +
          `${body.reason ? `Причина: ${body.reason}\n` : ''}` +
          `🕐 ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Bangkok' })}`,
      })
    }
    await recordAdminAudit({
      actorId,
      actorRole,
      action: active ? 'treasury_emergency_pause_on' : 'treasury_emergency_pause_off',
      entityType: 'treasury_ops',
      entityId: 'global',
      reason: body.reason ? String(body.reason).slice(0, 2000) : null,
      payload: { emergencyPause: active },
    })
  }

  if (body.treasuryManualMode !== undefined) {
    const manual = Boolean(body.treasuryManualMode)
    const r = await setTreasuryManualMode(manual)
    if (!r.success) {
      return NextResponse.json({ success: false, error: r.error }, { status: 500 })
    }
    await recordAdminAudit({
      actorId,
      actorRole,
      action: manual ? 'treasury_manual_mode_on' : 'treasury_manual_mode_off',
      entityType: 'treasury_ops',
      entityId: 'global',
      reason: body.reason ? String(body.reason).slice(0, 2000) : null,
      payload: { treasuryManualMode: manual },
    })
  }

  if (body.activateControlledLive === true) {
    const r = await activateControlledLive({
      startedBy: actorId,
      reason: body.reason,
    })
    if (!r.success) {
      return NextResponse.json(
        { success: false, error: r.error, message: r.message },
        { status: r.error === 'emergency_pause_active' ? 409 : 500 },
      )
    }
    await recordAdminAudit({
      actorId,
      actorRole,
      action: 'treasury_controlled_live_activated',
      entityType: 'treasury_ops',
      entityId: 'global',
      reason: body.reason ? String(body.reason).slice(0, 2000) : null,
      payload: { activateControlledLive: true },
    })
  }

  const ops = await loadTreasuryOpsSettings()
  return NextResponse.json({ success: true, data: { ops } })
}
