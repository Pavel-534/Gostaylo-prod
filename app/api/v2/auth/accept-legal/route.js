/**
 * POST /api/v2/auth/accept-legal
 * Одноразовое подтверждение оферты после OAuth-login без предварительной галочки в модалке.
 */
import { NextResponse } from 'next/server';
import { getSessionPayload } from '@/lib/services/session-service';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const session = await getSessionPayload();
  if (!session?.userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    /* ignore */
  }
  const accepted = body.acceptedLegalTerms === true || body.acceptedLegalTerms === 'true';
  if (!accepted) {
    return NextResponse.json(
      { success: false, error: 'LEGAL_TERMS_REQUIRED', code: 'LEGAL_TERMS_REQUIRED' },
      { status: 400 },
    );
  }

  const { data: before, error: beforeErr } = await supabaseAdmin
    .from('profiles')
    .select('legal_terms_accepted_at')
    .eq('id', session.userId)
    .maybeSingle();

  if (beforeErr) {
    return NextResponse.json({ success: false, error: beforeErr.message }, { status: 500 });
  }
  if (!before) {
    return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
  }
  if (before.legal_terms_accepted_at) {
    return NextResponse.json({
      success: true,
      legalTermsAcceptedAt: before.legal_terms_accepted_at,
      updated: false,
    });
  }

  const iso = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ legal_terms_accepted_at: iso, updated_at: iso })
    .eq('id', session.userId);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    legalTermsAcceptedAt: iso,
    updated: true,
  });
}
