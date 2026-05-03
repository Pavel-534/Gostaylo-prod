/**
 * GoStayLo - Auth Login API (v2)
 * POST /api/v2/auth/login
 *
 * Security: bcrypt-only passwords, JWT in HttpOnly cookie (30 days).
 * Errors: `error_code` only (no localized `error` string) — see ARCHITECTURAL_DECISIONS.md.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { rateLimitCheck } from '@/lib/rate-limit';
import { getJwtSecret } from '@/lib/auth/jwt-secret';
import {
  attachGostayloSessionCookie,
  profileRowToAuthUser,
  signJwtForProfile,
} from '@/lib/auth/app-session-issue';
import { AuthErrorCode, authErrorJson } from '@/lib/auth/auth-error-codes';

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
    return authErrorJson(AuthErrorCode.AUTH_JWT_NOT_CONFIGURED, 500);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return authErrorJson(AuthErrorCode.AUTH_DATABASE_NOT_CONFIGURED, 500);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let body;
  try {
    body = await request.json();
  } catch {
    return authErrorJson(AuthErrorCode.AUTH_INVALID_JSON, 400);
  }

  const { email, password, redirectTo: requestedRedirect } = body;

  if (!email || !password) {
    return authErrorJson(AuthErrorCode.AUTH_MISSING_CREDENTIALS, 400);
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
    return authErrorJson(AuthErrorCode.AUTH_INVALID_CREDENTIALS, 401);
  }

  if (user.is_banned === true) {
    return authErrorJson(AuthErrorCode.AUTH_ACCOUNT_SUSPENDED, 403);
  }

  let passwordValid = false;

  if (user.password_hash && user.password_hash.startsWith('$2')) {
    passwordValid = await bcrypt.compare(password, user.password_hash);
  }

  if (!passwordValid) {
    return authErrorJson(AuthErrorCode.AUTH_INVALID_CREDENTIALS, 401);
  }

  const role = String(user.role || 'RENTER').toUpperCase();
  const staffRole = role === 'ADMIN' || role === 'MODERATOR';

  if (!user.is_verified && !staffRole) {
    return NextResponse.json(
      {
        success: false,
        error_code: AuthErrorCode.AUTH_EMAIL_NOT_VERIFIED,
        requiresVerification: true,
        email: user.email,
      },
      { status: 403 },
    );
  }

  await supabase.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', user.id);

  const token = signJwtForProfile(user, jwtSecret);

  const redirectTo = requestedRedirect || ROLE_REDIRECTS[role] || '/';

  const response = NextResponse.json({
    success: true,
    user: profileRowToAuthUser(user),
    redirectTo,
  });

  attachGostayloSessionCookie(response, token);

  return response;
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/v2/auth/login',
    timestamp: new Date().toISOString(),
  });
}
