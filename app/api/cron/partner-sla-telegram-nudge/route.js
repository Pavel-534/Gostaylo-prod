/**
 * POST /api/cron/partner-sla-telegram-nudge — Telegram SLA reminders (Stage 19.0).
 * Vercel Cron: schedule in vercel.json; secret CRON_SECRET.
 */

import { NextResponse } from 'next/server'
import { runPartnerSlaTelegramNudges } from '@/lib/services/partner-sla-telegram-nudge'
import { startOpsJobRun, finishOpsJobRun } from '@/lib/ops-job-runs'

export const dynamic = 'force-dynamic'

const CRON_SECRET = process.env.CRON_SECRET

function authorize(request) {
  if (!CRON_SECRET) return false
  const authHeader = request.headers.get('authorization')
  const cronHeader = request.headers.get('x-cron-secret')
  return authHeader === `Bearer ${CRON_SECRET}` || cronHeader === CRON_SECRET
}

export async function POST(request) {
  if (!authorize(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
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
