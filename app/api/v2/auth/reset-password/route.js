/**
 * GoStayLo - Reset Password API
 * POST /api/v2/auth/reset-password
 * 
 * Sets new password from reset token
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getJwtSecret } from '@/lib/auth/jwt-secret';
import { AuthErrorCode, authErrorJson } from '@/lib/auth/auth-error-codes';
import {
  AUTH_PASSWORD_MIN_LENGTH,
  AUTH_PASSWORD_COMPLEXITY_RE,
} from '@/lib/auth/password-policy';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  let jwtSecret;
  try {
    jwtSecret = getJwtSecret();
  } catch (e) {
    return authErrorJson(AuthErrorCode.AUTH_JWT_NOT_CONFIGURED, 500);
  }

  console.log('[RESET-PASSWORD] ====== START ======');
  
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return authErrorJson(AuthErrorCode.AUTH_INVALID_JSON, 400);
  }
  
  const { token, password } = body;
  
  if (!token) {
    return authErrorJson(AuthErrorCode.AUTH_RESET_TOKEN_REQUIRED, 400);
  }

  if (!password || password.length < AUTH_PASSWORD_MIN_LENGTH) {
    return authErrorJson(AuthErrorCode.AUTH_PASSWORD_TOO_SHORT_RESET, 400);
  }

  if (!AUTH_PASSWORD_COMPLEXITY_RE.test(password)) {
    return authErrorJson(AuthErrorCode.AUTH_PASSWORD_REQUIREMENTS, 400);
  }
  
  // Verify token
  let decoded;
  try {
    decoded = jwt.verify(token, jwtSecret);
  } catch (error) {
    console.error('[RESET-PASSWORD] Invalid token:', error.message);
    return authErrorJson(AuthErrorCode.AUTH_RESET_TOKEN_INVALID, 400);
  }

  if (decoded.type !== 'password_reset') {
    return authErrorJson(AuthErrorCode.AUTH_RESET_TOKEN_WRONG_TYPE, 400);
  }
  
  const { userId, email } = decoded;
  const tokenEmailNorm = String(email || '').toLowerCase().trim();
  
  // Get Supabase client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !serviceKey) {
    return authErrorJson(AuthErrorCode.AUTH_DATABASE_NOT_CONFIGURED, 500);
  }
  
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  
  // Профиль по id из токена (email в JWT должен совпадать без учёта регистра)
  const { data: row, error: fetchErr } = await supabase
    .from('profiles')
    .select('id, email, first_name')
    .eq('id', userId)
    .maybeSingle();
  
  if (fetchErr || !row) {
    console.error('[RESET-PASSWORD] Profile fetch:', fetchErr?.message || 'not found');
    return authErrorJson(AuthErrorCode.AUTH_RESET_TOKEN_INVALID, 400);
  }

  if (String(row.email || '').toLowerCase().trim() !== tokenEmailNorm) {
    console.error('[RESET-PASSWORD] Email mismatch for user', userId);
    return authErrorJson(AuthErrorCode.AUTH_RESET_TOKEN_INVALID, 400);
  }
  
  const passwordHash = await bcrypt.hash(password, 10);
  
  // Только колонки из схемы profiles (password_reset_at в миграциях нет — иначе PostgREST падает)
  const { data: user, error } = await supabase
    .from('profiles')
    .update({
      password_hash: passwordHash,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select('id, email, first_name')
    .single();
  
  if (error || !user) {
    console.error('[RESET-PASSWORD] DB update:', error?.message, error?.details, error?.hint);
    return authErrorJson(AuthErrorCode.AUTH_PASSWORD_RESET_FAILED, 500);
  }

  console.log('[RESET-PASSWORD] Password reset for:', user.email);

  return NextResponse.json({ success: true });
}

export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    endpoint: '/api/v2/auth/reset-password',
    method: 'POST',
    timestamp: new Date().toISOString()
  });
}
