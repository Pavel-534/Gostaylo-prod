/**
 * POST /api/v2/admin/concierge/partners
 * ADR-210 Slice 2 — provision shadow PARTNER profile (ADMIN only).
 */

import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { AuthErrorCode } from '@/lib/auth/auth-error-codes'
import { normalizeAdminRole } from '@/lib/admin/admin-menu'
import { provisionConciergeShadowPartner } from '@/lib/services/concierge/concierge-supply.service.js'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const access = await requireAdminStaff(request)
  if (access.error) return access.error

  const role = normalizeAdminRole(access.profile?.role)
  if (role !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error_code: AuthErrorCode.AUTH_ACCESS_FORBIDDEN },
      { status: 403 },
    )
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const result = await provisionConciergeShadowPartner({
    email: body?.email,
    fullName: body?.fullName,
    phone: body?.phone,
    createdByAdminId: access.user?.id || access.profile?.id || null,
  })

  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        error: result.error,
        code: result.code,
        ...(result.profileId ? { profileId: result.profileId } : {}),
      },
      { status: result.status || 500 },
    )
  }

  return NextResponse.json(
    {
      success: true,
      reused: result.reused === true,
      profile: result.profile,
    },
    { status: result.status || 200 },
  )
}
