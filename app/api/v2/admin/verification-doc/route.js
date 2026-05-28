/**
 * GET /api/v2/admin/verification-doc?path=<object path in verification_documents bucket>
 * ADMIN only. Redirects to a short-lived Supabase signed URL (works for public or private bucket).
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'

export const dynamic = 'force-dynamic'

async function requireAdmin(request) {
  const access = await requireAdminStaff(request)
  if (access.error) return { error: access.error }
  return {}
}

export async function GET(request) {
  const auth = await requireAdmin(request)
  if (auth.error) {
    return auth.error
  }

  const { searchParams } = new URL(request.url)
  const path = searchParams.get('path') || ''
  if (!path || path.includes('..') || path.startsWith('/')) {
    return NextResponse.json({ success: false, error: 'Invalid path' }, { status: 400 })
  }
  if (!/^[\w.-]+(?:\/[\w.-]+)*$/.test(path)) {
    return NextResponse.json({ success: false, error: 'Invalid path format' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin.storage
    .from('verification_documents')
    .createSignedUrl(path, 120)

  if (error || !data?.signedUrl) {
    console.error('[verification-doc] signed URL failed', error?.message)
    return NextResponse.json(
      { success: false, error: error?.message || 'Signed URL failed' },
      { status: 502 },
    )
  }

  return NextResponse.redirect(data.signedUrl)
}
