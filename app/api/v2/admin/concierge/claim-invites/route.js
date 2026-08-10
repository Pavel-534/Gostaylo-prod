/**
 * POST /api/v2/admin/concierge/claim-invites
 * ADR-210 Slice 3 — create magic claim invite + email (ADMIN only).
 */

import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { AuthErrorCode } from '@/lib/auth/auth-error-codes'
import { normalizeAdminRole } from '@/lib/admin/admin-menu'
import { createPartnerClaimInvite } from '@/lib/services/concierge/concierge-claim.service.js'

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
    return NextResponse.json(
      { success: false, error: 'Invalid JSON', code: 'VALIDATION_ERROR' },
      { status: 400 },
    )
  }

  const result = await createPartnerClaimInvite({
    partnerProfileId: body?.partnerProfileId,
    email: body?.email,
    batchId: body?.batchId,
    expiresInDays: body?.expiresInDays,
    createdByAdminId: access.user?.id || access.profile?.id || null,
    sendEmail: body?.sendEmail !== false,
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
      inviteId: result.inviteId,
      expiresAt: result.expiresAt,
      claimUrl: result.claimUrl,
    },
    { status: result.status || 201 },
  )
}
