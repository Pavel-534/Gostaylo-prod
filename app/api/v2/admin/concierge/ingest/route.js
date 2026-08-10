/**
 * POST /api/v2/admin/concierge/ingest
 * ADR-210 Slice 2 — atomic-ish Concierge listing ingest (ADMIN only).
 */

import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { AuthErrorCode } from '@/lib/auth/auth-error-codes'
import { normalizeAdminRole } from '@/lib/admin/admin-menu'
import { ingestConciergeListings } from '@/lib/services/concierge/concierge-supply.service.js'

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

  const result = await ingestConciergeListings({
    partnerProfileId: body?.partnerProfileId,
    sourceType: body?.sourceType,
    sourceLabel: body?.sourceLabel,
    mappingProfile: body?.mappingProfile,
    listings: body?.listings,
    createdByAdminId: access.user?.id || access.profile?.id || null,
    autoRehostMedia: body?.autoRehostMedia !== false,
  })

  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        error: result.error,
        code: result.code,
        ...(result.batchId ? { batchId: result.batchId } : {}),
      },
      { status: result.status || 500 },
    )
  }

  return NextResponse.json({
    success: true,
    batchId: result.batchId,
    importedListingsCount: result.importedListingsCount,
    listingIds: result.listingIds,
    ...(result.warnings?.length ? { warnings: result.warnings } : {}),
    ...(result.mediaWarnings?.length ? { mediaWarnings: result.mediaWarnings } : {}),
    ...(result.mediaRehost
      ? {
          mediaRehost: {
            processedListings: result.mediaRehost.processedListings ?? 0,
            updatedImagesCount: result.mediaRehost.updatedImagesCount ?? 0,
            errors: result.mediaRehost.errors || [],
          },
        }
      : {}),
    ...(result.partnerNotify ? { partnerNotify: result.partnerNotify } : {}),
  })
}
