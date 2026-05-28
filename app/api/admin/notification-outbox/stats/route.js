/**
 * GET /api/admin/notification-outbox/stats — ADMIN session; counts by status (Stage 60.0).
 */
import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { getNotificationOutboxStats } from '@/lib/services/notifications/notification-outbox-stats.js'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const gate = await requireAdminStaff(request)
  if (gate.error) return gate.error
  const stats = await getNotificationOutboxStats()
  if (!stats.success) {
    return NextResponse.json(
      { success: false, error: stats.error || 'stats_failed', counts: stats.counts },
      { status: 500 },
    )
  }
  return NextResponse.json({ success: true, counts: stats.counts, total: stats.total })
}
