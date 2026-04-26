/**
 * POST /api/admin/notification-outbox/process — ADMIN session; runs same worker as cron (Stage 59.0).
 */
import { NextResponse } from 'next/server'
import { resolveAdminSecurityProfile } from '@/lib/admin-security-access'
import { runNotificationOutboxWorker } from '@/lib/services/notifications/process-notification-outbox.js'

export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await resolveAdminSecurityProfile()
  if (session.error) {
    return NextResponse.json({ success: false, error: session.error.message }, { status: session.error.status })
  }
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
