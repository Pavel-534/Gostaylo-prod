/**
 * GET /api/v2/admin/verification-doc?path=<object path in verification_documents bucket>
 * ADMIN only. Redirects to a short-lived Supabase signed URL (works for public or private bucket).
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSessionPayload } from '@/lib/services/session-service'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const session = await getSessionPayload()
  if (!session?.userId) return { error: 'Unauthorized', status: 401 }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', session.userId)
    .maybeSingle()
  if (error) return { error: error.message, status: 500 }

  if (String(data?.role || '').toUpperCase() !== 'ADMIN') {
    return { error: 'Admin access required', status: 403 }
  }
  return {}
}

export async function GET(request) {
  const auth = await requireAdmin()
  if (auth.error) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
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
