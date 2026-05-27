/**
 * PATCH /api/v2/admin/users/[id]/contact-strikes
 * Body: { strikes: number } | { action: 'reset' | 'increment', delta?: number }
 * Только ADMIN.
 */

import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import {
  adjustContactLeakStrikes,
  resetContactLeakStrikes,
  setContactLeakStrikes,
} from '@/lib/contact-safety/contact-leak-strikes-admin'

export const dynamic = 'force-dynamic'

export async function PATCH(request, { params }) {
  const gate = await requireAdminStaff(request)
  if (gate.error) return gate.error

  const userId = params?.id
  if (!userId) {
    return NextResponse.json({ success: false, error: 'User id required' }, { status: 400 })
  }

  let body = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  let result
  const action = String(body.action || '').toLowerCase()
  if (action === 'reset') {
    result = await resetContactLeakStrikes(userId)
  } else if (action === 'increment') {
    const delta = Math.max(1, Math.min(50, parseInt(String(body.delta ?? 1), 10) || 1))
    result = await adjustContactLeakStrikes(userId, delta)
  } else if (body.strikes != null) {
    result = await setContactLeakStrikes(userId, body.strikes)
  } else {
    return NextResponse.json(
      { success: false, error: 'Provide strikes, action=reset, or action=increment' },
      { status: 400 },
    )
  }

  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error || 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: { userId, strikes: result.strikes } })
}
