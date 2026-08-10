/**
 * POST /api/v2/admin/concierge/rehost-media
 * ADR-210 Slice 4 — batch rehost external HTTPS images → listing-images/concierge/...
 */

import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { AuthErrorCode } from '@/lib/auth/auth-error-codes'
import { normalizeAdminRole } from '@/lib/admin/admin-menu'
import { rehostConciergeMedia } from '@/lib/services/concierge/concierge-media.service.js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

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

  const result = await rehostConciergeMedia({
    listingId: body?.listingId,
    batchId: body?.batchId,
    force: body?.force === true,
  })

  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        error: result.error,
        code: result.code,
        processedListings: result.processedListings || 0,
        updatedImagesCount: result.updatedImagesCount || 0,
        errors: result.errors || [],
      },
      { status: result.status || 500 },
    )
  }

  return NextResponse.json({
    success: true,
    processedListings: result.processedListings,
    updatedImagesCount: result.updatedImagesCount,
    errors: result.errors || [],
    ...(result.mediaWarnings?.length ? { mediaWarnings: result.mediaWarnings } : {}),
  })
}
