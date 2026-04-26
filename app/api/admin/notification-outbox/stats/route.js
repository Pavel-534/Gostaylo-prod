/**
 * GET /api/admin/notification-outbox/stats — ADMIN session; counts by status (Stage 60.0).
 */
import { NextResponse } from 'next/server'
import { resolveAdminSecurityProfile } from '@/lib/admin-security-access'
import { getNotificationOutboxStats } from '@/lib/services/notifications/notification-outbox-stats.js'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await resolveAdminSecurityProfile()
  if (session.error) {
    return NextResponse.json({ success: false, error: session.error.message }, { status: session.error.status })
  }
  const stats = await getNotificationOutboxStats()
  if (!stats.success) {
    return NextResponse.json(
      { success: false, error: stats.error || 'stats_failed', counts: stats.counts },
      { status: 500 },
    )
  }
  return NextResponse.json({ success: true, counts: stats.counts, total: stats.total })
}
