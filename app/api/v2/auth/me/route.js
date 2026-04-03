/**
 * GoStayLo - Get Current User API
 * GET /api/v2/auth/me
 *
 * Returns user from JWT session cookie; refreshes cookie if DB role differs from JWT.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/lib/auth/jwt-secret';
import { stripLegacyModeratorMarker } from '@/lib/auth/display-name';

export const dynamic = 'force-dynamic';

export async function GET() {
  let jwtSecret;
  try {
    jwtSecret = getJwtSecret();
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message, user: null }, { status: 500 });
  }

  const cookieStore = cookies();
  const sessionCookie = cookieStore.get('gostaylo_session');

  if (!sessionCookie?.value) {
    return NextResponse.json({ success: false, user: null }, { status: 401 });
  }

  let decoded;
  try {
    decoded = jwt.verify(sessionCookie.value, jwtSecret);
  } catch {
    return NextResponse.json({ success: false, user: null, error: 'Invalid session' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 });
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: user, error } = await supabase.from('profiles').select('*').eq('id', decoded.userId).single();

  if (error || !user) {
    return NextResponse.json({ success: false, user: null }, { status: 401 });
  }

  const dbRole = String(user.role || 'RENTER').toUpperCase();
  const jwtRole = String(decoded.role || '').toUpperCase();
  const needsJwtRefresh = jwtRole !== dbRole;

  const displayLast = stripLegacyModeratorMarker(user.last_name);

  const payload = {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      role: dbRole,
      firstName: user.first_name,
      lastName: displayLast,
      first_name: user.first_name,
      last_name: displayLast,
      name: `${user.first_name || ''} ${displayLast}`.trim(),
      phone: user.phone,
      referralCode: user.referral_code,
      referral_code: user.referral_code,
      isVerified: user.is_verified,
      is_verified: user.is_verified,
      verification_status: user.verification_status,
      rejection_reason: user.rejection_reason,
      preferredCurrency: user.preferred_currency,
      preferred_currency: user.preferred_currency,
      telegram_id: user.telegram_id,
      email_verified_at: user.email_verified_at,
      created_at: user.created_at,
      isModerator: dbRole === 'MODERATOR',
    },
  };

  const res = NextResponse.json(payload);

  if (needsJwtRefresh) {
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: dbRole,
        firstName: user.first_name,
      },
      jwtSecret,
      { expiresIn: '30d' }
    );
    const secureCookie =
      process.env.NODE_ENV === 'production' || process.env.FORCE_SECURE_COOKIES === 'true';
    res.cookies.set('gostaylo_session', token, {
      httpOnly: true,
      secure: secureCookie,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
  }

  return res;
}
