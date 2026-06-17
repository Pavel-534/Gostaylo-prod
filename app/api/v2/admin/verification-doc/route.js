/**
 * GET /api/v2/admin/verification-doc?path=<object path in verification_documents bucket>
 * Staff only. Redirects to a 15-minute Supabase signed URL (private bucket).
 */

import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import {
  createVerificationDocSignedUrl,
  isSafeVerificationDocObjectPath,
} from '@/lib/storage/verification-doc-access'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const access = await requireAdminStaff(request)
  if (access.error) return access.error

  const { searchParams } = new URL(request.url)
  const path = String(searchParams.get('path') || '').trim()
  if (!isSafeVerificationDocObjectPath(path)) {
    return NextResponse.json({ success: false, error: 'Invalid path' }, { status: 400 })
  }

  const signed = await createVerificationDocSignedUrl(path)
  if (!signed.success || !signed.signedUrl) {
    console.error('[verification-doc] signed URL failed', signed.error)
    return NextResponse.json(
      { success: false, error: signed.error || 'Signed URL failed' },
      { status: 502 },
    )
  }

  return NextResponse.redirect(signed.signedUrl)
}
