/**
 * POST /api/cron/partner-sla-telegram-nudge — Telegram SLA reminders (Stage 19.0).
 * Vercel Cron: schedule in vercel.json; secret CRON_SECRET.
 */

import { NextResponse } from 'next/server'
import { runPartnerSlaTelegramNudges } from '@/lib/services/partner-sla-telegram-nudge'
import { startOpsJobRun, finishOpsJobRun } from '@/lib/ops-job-runs'
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied
  const run = await startOpsJobRun('partner-sla-telegram-nudge')
  try {
    const meta = await runPartnerSlaTelegramNudges()
    await finishOpsJobRun(run, { status: 'success', stats: meta })
    return NextResponse.json({ success: true, meta })
  } catch (e) {
    console.error('[CRON partner-sla-telegram-nudge]', e)
    await finishOpsJobRun(run, { status: 'error', errorMessage: e?.message })
    return NextResponse.json({ success: false, error: e?.message || 'error' }, { status: 500 })
  }
}

export async function GET(request) {
  return POST(request)
}
