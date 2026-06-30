/**
 * PATCH /api/admin/reviews/[id]/moderation — approve or remove flagged review.
 * Body: { status: 'approved' | 'removed', source: 'reviews' | 'guest_reviews' }
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { applyReviewModerationDecision } from '@/lib/reviews/review-moderation-admin.service.js'

export async function PATCH(request, { params }) {
  const gate = await requireAdminStaff(request)
  if (gate.error) return gate.error

  const id = params?.id
  if (!id) {
    return NextResponse.json({ success: false, error: 'Review id required' }, { status: 400 })
  }

  let body = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const result = await applyReviewModerationDecision({
    id,
    source: body.source,
    status: body.status,
    staffUserId: gate.profile?.id,
  })

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status || 500 },
    )
  }

  return NextResponse.json({ success: true, data: result.data })
}
