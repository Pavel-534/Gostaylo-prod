/**
 * POST/GET /api/v2/system/notifications/process-outbox
 * Stage 59.0 — drain notification_outbox (CRON_SECRET / Bearer, same SSOT as `/api/cron/*`).
 */
import { NextResponse } from 'next/server'
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js'
import { runNotificationOutboxWorker } from '@/lib/services/notifications/process-notification-outbox.js'

export const dynamic = 'force-dynamic'

async function handle(request) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied
  try {
    const result = await runNotificationOutboxWorker({ limit: 20 })
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e?.message || 'Internal error' },
      { status: 500 },
    )
  }
}

export async function POST(request) {
  return handle(request)
}

export async function GET(request) {
  return handle(request)
}
