import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserIdFromSession, verifyPartnerAccess } from '@/lib/services/session-service'

export const dynamic = 'force-dynamic'

/**
 * POST /api/v2/partner/verification-light
 * Phone + ID doc URL → profiles (KYC light, Stage 141.3).
 */
export async function POST(request) {
  try {
    const userId = await getUserIdFromSession()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const partner = await verifyPartnerAccess(userId)
    if (!partner) {
      return NextResponse.json({ success: false, error: 'Partner access required' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const phone = String(body?.phone || '').trim().slice(0, 40)
    const verificationDocUrl = String(body?.verificationDocUrl || body?.verification_doc_url || '').trim()

    if (!phone || phone.length < 6) {
      return NextResponse.json({ success: false, error: 'Valid phone is required' }, { status: 400 })
    }
    if (!verificationDocUrl || !verificationDocUrl.includes('verification_documents')) {
      return NextResponse.json({ success: false, error: 'verificationDocUrl required' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const { data: row, error: loadErr } = await supabaseAdmin
      .from('profiles')
      .select('id, metadata, is_verified, verification_status')
      .eq('id', userId)
      .maybeSingle()
    if (loadErr || !row) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 })
    }

    const meta = row.metadata && typeof row.metadata === 'object' ? { ...row.metadata } : {}
    meta.host_verification_doc_url = verificationDocUrl
    meta.host_verification_submitted_at = now
    meta.host_verification_phone = phone

    const alreadyVerified = row.is_verified === true || String(row.verification_status || '').toUpperCase() === 'VERIFIED'
    const patch = {
      phone,
      metadata: meta,
      updated_at: now,
    }
    if (!alreadyVerified) {
      patch.verification_status = 'PENDING'
    }

    const { error: upErr } = await supabaseAdmin.from('profiles').update(patch).eq('id', userId)
    if (upErr) {
      return NextResponse.json({ success: false, error: upErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        verificationStatus: patch.verification_status || row.verification_status,
        submittedAt: now,
      },
    })
  } catch (e) {
    console.error('[PARTNER VERIFICATION LIGHT]', e)
    return NextResponse.json({ success: false, error: e.message || 'Internal error' }, { status: 500 })
  }
}
