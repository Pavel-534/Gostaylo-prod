/**
 * GoStayLo - Auth Login API (v2)
 * POST /api/v2/auth/login
 *
 * Security: bcrypt-only passwords, JWT in HttpOnly cookie (30 days).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { rateLimitCheck } from '@/lib/rate-limit';
import { getJwtSecret } from '@/lib/auth/jwt-secret';
import { stripLegacyModeratorMarker } from '@/lib/auth/display-name';

export const dynamic = 'force-dynamic';

const ROLE_REDIRECTS = {
  ADMIN: '/admin/dashboard',
  MODERATOR: '/admin/moderation',
  PARTNER: '/partner/dashboard',
  RENTER: '/',
  USER: '/',
};

export async function POST(request) {
  const rl = rateLimitCheck(request, 'auth');
  if (rl) {
    return NextResponse.json(rl.body, { status: rl.status, headers: rl.headers });
  }

  let jwtSecret;
  try {
    jwtSecret = getJwtSecret();
  } catch (e) {
    console.error('[AUTH LOGIN]', e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 });
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { email, password, redirectTo: requestedRedirect } = body;

  if (!email || !password) {
    return NextResponse.json({ success: false, error: 'Email and password required' }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  let user = null;

  const { data: exactUser } = await supabase.from('profiles').select('*').eq('email', email).single();

  if (exactUser) {
    user = exactUser;
  } else {
    const { data: lowerUser } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', normalizedEmail)
      .single();
    user = lowerUser;
  }

  if (!user) {
    return NextResponse.json({ success: false, error: 'Invalid email or password' }, { status: 401 });
  }

  if (user.is_banned === true) {
    return NextResponse.json({ success: false, error: 'Account suspended' }, { status: 403 });
  }

  let passwordValid = false;

  if (user.password_hash && user.password_hash.startsWith('$2')) {
    passwordValid = await bcrypt.compare(password, user.password_hash);
  }

  if (!passwordValid) {
    return NextResponse.json({ success: false, error: 'Invalid email or password' }, { status: 401 });
  }

  const role = String(user.role || 'RENTER').toUpperCase();
  const staffRole = role === 'ADMIN' || role === 'MODERATOR';

  if (!user.is_verified && !staffRole) {
    return NextResponse.json(
      {
        success: false,
        error: 'Please verify your email first',
        requiresVerification: true,
        email: user.email,
      },
      { status: 403 }
    );
  }

  await supabase.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', user.id);

  const displayLast = stripLegacyModeratorMarker(user.last_name);
  const rawAvatar = user.avatar && String(user.avatar).trim();

  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role,
      firstName: user.first_name,
    },
    jwtSecret,
    { expiresIn: '30d' }
  );

  const redirectTo = requestedRedirect || ROLE_REDIRECTS[role] || '/';

  const response = NextResponse.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      role,
      firstName: user.first_name,
      lastName: displayLast,
      name: `${user.first_name || ''} ${displayLast}`.trim(),
      phone: user.phone || null,
      avatar: rawAvatar || null,
      referralCode: user.referral_code,
      isVerified: user.is_verified,
      preferredCurrency: user.preferred_currency,
      preferredPayoutCurrency: user.preferred_payout_currency || user.preferred_currency || 'THB',
      telegram_id: user.telegram_id || null,
      telegram_username: user.telegram_username || null,
      isModerator: role === 'MODERATOR',
    },
    redirectTo,
  });

  const secureCookie =
    process.env.NODE_ENV === 'production' || process.env.FORCE_SECURE_COOKIES === 'true';
  response.cookies.set('gostaylo_session', token, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });

  return response;
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/v2/auth/login',
    timestamp: new Date().toISOString(),
  });
}
