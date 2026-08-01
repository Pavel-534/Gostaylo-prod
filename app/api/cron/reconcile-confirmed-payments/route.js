/**
 * POST /api/cron/reconcile-confirmed-payments
 * AUDIT_03 C3.4 + AUDIT_MONEY_FLOW_04 — heal:
 *   - legacy payments.status=CONFIRMED without escrow
 *   - payment_intents.status=PAID without escrow (age ≥ 5m)
 *   - CRYPTO payments with txid without escrow
 *
 * Vercel Hobby: daily fallback in vercel.json only.
 * Production cadence: cron-job.org hourly — see docs/runbooks/CRON_EXTERNAL_FINANCIAL.md
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js'
import { startOpsJobRun, finishOpsJobRun } from '@/lib/ops-job-runs'
import { runReconcileConfirmedPaymentsCron } from '@/lib/payment/reconcile-confirmed-without-escrow.js'
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js'
import { runStaleCronMonitor } from '@/lib/ops/stale-cron-monitor.js'

export async function POST(request) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied

  const run = await startOpsJobRun('reconcile-confirmed-payments')
  try {
    const result = await runReconcileConfirmedPaymentsCron({ limit: 50 })
    const errCount = Number(result.errors) || 0
    const failed = result.success === false || errCount > 0
    await finishOpsJobRun(run, {
      status: failed ? 'error' : 'success',
      stats: {
        summary: result.summary,
        legacy_confirmed: result.legacy_confirmed,
        intents_healed: result.intents_healed,
        intents_skipped: result.intents_skipped,
        errors: errCount,
        legacy: {
          processed: result.legacy?.processed,
          healed: result.legacy?.healed,
          failed: result.legacy?.failed,
          skipped: result.legacy?.skipped,
        },
        intents: {
          processed: result.intents?.processed,
          healed: result.intents?.healed,
          failed: result.intents?.failed,
          skipped: result.intents?.skipped,
        },
        crypto: {
          processed: result.crypto?.processed,
          healed: result.crypto?.healed,
          failed: result.crypto?.failed,
          skipped: result.crypto?.skipped,
        },
      },
      errorMessage: failed
        ? errCount > 0
          ? `${errCount} escrow heal failures`
          : String(result.legacy?.error || result.intents?.error || result.crypto?.error || 'reconcile_failed')
        : null,
    })

    const orphaned = Number(result.intents_healed || 0) + Number(result.intents_skipped || 0)
    if (orphaned > 0) {
      void notifySystemAlert(
        `[HEAL] Found ${orphaned} orphaned intents, healed ${result.intents_healed}, skipped ${result.intents_skipped}, errors ${errCount}\n` +
          `<code>${escapeSystemAlertHtml(result.summary || '')}</code>`,
      )
    } else if (errCount > 0 || failed) {
      void notifySystemAlert(
        `🔧 <b>Cron: reconcile-confirmed-payments</b> — ${escapeSystemAlertHtml(result.summary || '')}\n` +
          `<code>${escapeSystemAlertHtml(JSON.stringify(result.legacy?.errors || []).slice(0, 400))}</code>`,
      )
    }

    void runStaleCronMonitor().catch(() => {})
    return NextResponse.json({ success: !failed, ...result })
  } catch (e) {
    await finishOpsJobRun(run, { status: 'error', errorMessage: e?.message })
    void notifySystemAlert(
      `🔧 <b>Cron: reconcile-confirmed-payments</b>\n<code>${escapeSystemAlertHtml(e?.message || e)}</code>`,
    )
    void runStaleCronMonitor().catch(() => {})
    return NextResponse.json({ success: false, error: e?.message }, { status: 500 })
  }
}

export async function GET(request) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied
  return NextResponse.json({
    success: true,
    message:
      'Heals payments.CONFIRMED + payment_intents.PAID + CRYPTO+txid when booking is not yet in escrow (moveToEscrow retry)',
  })
}
