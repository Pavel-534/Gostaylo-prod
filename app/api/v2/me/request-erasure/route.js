/**
 * POST /api/v2/me/request-erasure — queue account deletion (30d grace).
 * DELETE /api/v2/me/request-erasure — cancel pending request.
 * GET /api/v2/me/request-erasure — erasure status.
 */

import { NextResponse } from 'next/server'
import {
  requestDataErasure,
  cancelDataErasure,
  getErasureStatusForUser,
  attachErasureSessionClear,
} from '@/lib/privacy/data-subject-erasure.service'
import { requireSessionUser } from '@/lib/privacy/require-session-user'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireSessionUser()
  if (auth.error) return auth.error

  const status = await getErasureStatusForUser(auth.userId)
  return NextResponse.json({ success: true, data: status })
}

export async function POST(request) {
  const auth = await requireSessionUser()
  if (auth.error) return auth.error

  let body = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const result = await requestDataErasure(auth.userId, {
    reason: body.reason || body.message,
  })

  if (!result.ok) {
    const status =
      result.error === 'ACTIVE_BOOKINGS' || result.error === 'ACTIVE_LISTINGS' ? 409 : 400
    return NextResponse.json(
      {
        success: false,
        error: result.error,
        detail: result.detail || null,
        booking_ids: result.booking_ids || undefined,
      },
      { status },
    )
  }

  return NextResponse.json({
    success: true,
    duplicate: result.duplicate === true,
    data: {
      id: result.request.id,
      status: result.request.status,
      requested_at: result.request.requested_at,
      scheduled_for: result.request.scheduled_for,
    },
  })
}

export async function DELETE() {
  const auth = await requireSessionUser()
  if (auth.error) return auth.error

  const result = await cancelDataErasure(auth.userId)
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 404 })
  }

  return NextResponse.json({ success: true, cancelled: true })
}
