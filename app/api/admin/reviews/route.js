/**
 * GET /api/admin/reviews — flagged review queue (ADMIN / MODERATOR).
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { listFlaggedReviewsForAdmin } from '@/lib/reviews/review-moderation-admin.service.js'

export async function GET(request) {
  const gate = await requireAdminStaff(request)
  if (gate.error) return gate.error

  const { searchParams } = new URL(request.url)
  const limit = searchParams.get('limit')

  const { items, errors } = await listFlaggedReviewsForAdmin({ limit })
  return NextResponse.json({
    success: true,
    data: { items, total: items.length },
    ...(errors.length ? { warnings: errors } : {}),
  })
}
