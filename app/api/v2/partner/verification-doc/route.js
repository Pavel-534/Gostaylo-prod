/**
 * GET /api/v2/partner/verification-doc?path=<object path in verification_documents bucket>
 * Owner-only (path prefix = session profile id). Redirects to 15-minute signed URL.
 */

import { NextResponse } from 'next/server'
import { getUserIdFromSession } from '@/lib/services/session-service'
import { AuthErrorCode, authErrorJson } from '@/lib/auth/auth-error-codes'
import {
  createVerificationDocSignedUrl,
  isSafeVerificationDocObjectPath,
  verificationDocPathOwnedByUser,
} from '@/lib/storage/verification-doc-access'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const userId = await getUserIdFromSession()
  if (!userId) {
    return authErrorJson(AuthErrorCode.AUTH_NOT_AUTHENTICATED, 401)
  }

  const { searchParams } = new URL(request.url)
  const path = String(searchParams.get('path') || '').trim()
  if (!isSafeVerificationDocObjectPath(path)) {
    return NextResponse.json({ success: false, error: 'Invalid path' }, { status: 400 })
  }
  if (!verificationDocPathOwnedByUser(path, userId)) {
    return authErrorJson(AuthErrorCode.AUTH_ACCESS_FORBIDDEN, 403)
  }

  const signed = await createVerificationDocSignedUrl(path)
  if (!signed.success || !signed.signedUrl) {
    console.error('[partner/verification-doc] signed URL failed', signed.error)
    return NextResponse.json(
      { success: false, error: signed.error || 'Signed URL failed' },
      { status: 502 },
    )
  }

  return NextResponse.redirect(signed.signedUrl)
}
