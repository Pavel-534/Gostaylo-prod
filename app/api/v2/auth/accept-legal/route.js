/**
 * POST /api/v2/auth/accept-legal
 * Одноразовое подтверждение оферты после OAuth-login без предварительной галочки в модалке.
 */
import { NextResponse } from 'next/server';
import { getSessionPayload } from '@/lib/services/session-service';
import { supabaseAdmin } from '@/lib/supabase';
import { AuthErrorCode, authErrorJson } from '@/lib/auth/auth-error-codes';
import { CURRENT_LEGAL_TERMS_VERSION } from '@/lib/config/legal-terms-version';

export const dynamic = 'force-dynamic';

function isMissingTermsColumnsError(err) {
  const msg = String(err?.message || '').toLowerCase();
  return err?.code === '42703' || msg.includes('terms_accepted');
}

export async function POST(request) {
  const session = await getSessionPayload();
  if (!session?.userId) {
    return authErrorJson(AuthErrorCode.AUTH_NOT_AUTHENTICATED, 401);
  }
  if (!supabaseAdmin) {
    return authErrorJson(AuthErrorCode.AUTH_DATABASE_NOT_CONFIGURED, 500);
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    /* ignore */
  }
  const accepted = body.acceptedLegalTerms === true || body.acceptedLegalTerms === 'true';
  if (!accepted) {
    return authErrorJson(AuthErrorCode.AUTH_LEGAL_TERMS_NOT_ACCEPTED, 400);
  }

  let before = null;
  let beforeErr = null;
  let hasTermsColumns = true;

  ({ data: before, error: beforeErr } = await supabaseAdmin
    .from('profiles')
    .select('legal_terms_accepted_at, terms_accepted, terms_accepted_at')
    .eq('id', session.userId)
    .maybeSingle());

  if (beforeErr && isMissingTermsColumnsError(beforeErr)) {
    hasTermsColumns = false;
    ({ data: before, error: beforeErr } = await supabaseAdmin
      .from('profiles')
      .select('legal_terms_accepted_at')
      .eq('id', session.userId)
      .maybeSingle());
  }

  if (beforeErr) {
    return authErrorJson(AuthErrorCode.AUTH_INTERNAL, 500);
  }
  if (!before) {
    return authErrorJson(AuthErrorCode.AUTH_PROFILE_NOT_FOUND, 404);
  }
  if (before.terms_accepted === true || before.terms_accepted_at || before.legal_terms_accepted_at) {
    const acceptedAt = before.terms_accepted_at || before.legal_terms_accepted_at || null;
    return NextResponse.json({
      success: true,
      termsAccepted: true,
      termsAcceptedAt: acceptedAt,
      legalTermsAcceptedAt: acceptedAt,
      updated: false,
    });
  }

  const iso = new Date().toISOString();
  const updatePayload = hasTermsColumns
    ? {
        terms_accepted: true,
        terms_accepted_at: iso,
        legal_terms_accepted_at: iso,
        terms_version: CURRENT_LEGAL_TERMS_VERSION,
        updated_at: iso,
      }
    : {
        legal_terms_accepted_at: iso,
        updated_at: iso,
      };
  const { error } = await supabaseAdmin.from('profiles').update(updatePayload).eq('id', session.userId);

  if (error) {
    // Idempotent fallback: параллельный запрос мог успеть записать согласие первым.
    const { data: after, error: afterErr } = await supabaseAdmin
      .from('profiles')
      .select('legal_terms_accepted_at')
      .eq('id', session.userId)
      .maybeSingle();
    if (!afterErr && after?.legal_terms_accepted_at) {
      return NextResponse.json({
        success: true,
        termsAccepted: true,
        termsAcceptedAt: after.legal_terms_accepted_at,
        legalTermsAcceptedAt: after.legal_terms_accepted_at,
        updated: false,
      });
    }
    return authErrorJson(AuthErrorCode.AUTH_INTERNAL, 500);
  }

  return NextResponse.json({
    success: true,
    termsAccepted: true,
    termsAcceptedAt: iso,
    legalTermsAcceptedAt: iso,
    updated: true,
  });
}
