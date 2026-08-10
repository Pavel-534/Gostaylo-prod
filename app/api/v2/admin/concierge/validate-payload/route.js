/**
 * POST /api/v2/admin/concierge/validate-payload
 * ADR-210 Slice 6 — dry-run mapping + structure validation (no DB writes).
 */

import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { AuthErrorCode } from '@/lib/auth/auth-error-codes'
import { normalizeAdminRole } from '@/lib/admin/admin-menu'
import { validateConciergePayload } from '@/lib/services/concierge/mapping-profiles/validate-payload.service.js'
import { listMappingProfiles } from '@/lib/services/concierge/mapping-profiles/index.js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request) {
  const access = await requireAdminStaff(request)
  if (access.error) return access.error
  const role = normalizeAdminRole(access.profile?.role)
  if (role !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error_code: AuthErrorCode.AUTH_ACCESS_FORBIDDEN },
      { status: 403 },
    )
  }
  return NextResponse.json({
    success: true,
    mappingProfiles: listMappingProfiles(),
  })
}

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

  const result = await validateConciergePayload({
    mappingProfile: body?.mappingProfile,
    listings: body?.listings,
    rateToThb: body?.rateToThb,
    checkImageUrls: body?.checkImageUrls !== false,
  })

  if (!result.ok && result.status === 400) {
    return NextResponse.json(
      {
        success: false,
        valid: false,
        error: result.error,
        code: result.code,
        summary: result.summary,
      },
      { status: 400 },
    )
  }

  return NextResponse.json({
    success: true,
    valid: result.valid === true,
    mappingProfile: result.mappingProfile,
    summary: result.summary,
    ...(result.valid && Array.isArray(result.listings)
      ? {
          previewListingsCount: result.listings.length,
          listings: result.listings,
        }
      : {}),
  })
}
