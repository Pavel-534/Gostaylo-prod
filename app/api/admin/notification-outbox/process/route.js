/**
 * POST /api/admin/notification-outbox/process — ADMIN session; runs same worker as cron (Stage 59.0).
 */
import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { runNotificationOutboxWorker } from '@/lib/services/notifications/process-notification-outbox.js'

export const dynamic = 'force-dynamic'

export async function POST() {
  const gate = await requireAdminStaff()
  if (gate.error) return gate.error
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
