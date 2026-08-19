/**
 * GET/POST /api/v2/referral/consent — MLM disclosure consent (ADR-131A §6).
 * Self-update only: session.userId. Idempotent POST.
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'
import { supabaseAdmin } from '@/lib/supabase'
import { AuthErrorCode, authErrorJson } from '@/lib/auth/auth-error-codes'

function consentPayload(consentAt) {
  const at = consentAt ? String(consentAt) : null
  return { hasConsent: Boolean(at), consentAt: at }
}

export async function GET() {
  const session = await getSessionPayload()
  if (!session?.userId) {
    return authErrorJson(AuthErrorCode.AUTH_NOT_AUTHENTICATED, 401)
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 })
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('referral_mlm_consent_at')
    .eq('id', session.userId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ success: false, error: error.message || 'Profile not found' }, { status: 500 })
  }
  if (!data) {
    return authErrorJson(AuthErrorCode.AUTH_PROFILE_NOT_FOUND, 404)
  }

  return NextResponse.json({ success: true, ...consentPayload(data.referral_mlm_consent_at) })
}

export async function POST() {
  const session = await getSessionPayload()
  if (!session?.userId) {
    return authErrorJson(AuthErrorCode.AUTH_NOT_AUTHENTICATED, 401)
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 })
  }

  const { data: existing, error: readError } = await supabaseAdmin
    .from('profiles')
    .select('referral_mlm_consent_at')
    .eq('id', session.userId)
    .maybeSingle()

  if (readError) {
    return NextResponse.json({ success: false, error: readError.message || 'Profile not found' }, { status: 500 })
  }
  if (!existing) {
    return authErrorJson(AuthErrorCode.AUTH_PROFILE_NOT_FOUND, 404)
  }

  if (existing.referral_mlm_consent_at) {
    return NextResponse.json({ success: true, ...consentPayload(existing.referral_mlm_consent_at) })
  }

  const now = new Date().toISOString()
  const { data: updated, error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({ referral_mlm_consent_at: now, updated_at: now })
    .eq('id', session.userId)
    .is('referral_mlm_consent_at', null)
    .select('referral_mlm_consent_at')
    .maybeSingle()

  if (updateError) {
    return NextResponse.json({ success: false, error: updateError.message || 'CONSENT_UPDATE_FAILED' }, { status: 500 })
  }

  const consentAt = updated?.referral_mlm_consent_at || now
  return NextResponse.json({ success: true, ...consentPayload(consentAt) })
}
