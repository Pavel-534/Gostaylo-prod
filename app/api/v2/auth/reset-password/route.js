/**
 * Gostaylo - Reset Password API
 * POST /api/v2/auth/reset-password
 * 
 * Sets new password from reset token
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'gostaylo-secret-key-change-in-production';

export async function POST(request) {
  console.log('[RESET-PASSWORD] ====== START ======');
  
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }
  
  const { token, password } = body;
  
  if (!token) {
    return NextResponse.json({ success: false, error: 'Token is required' }, { status: 400 });
  }
  
  if (!password || password.length < 6) {
    return NextResponse.json({ success: false, error: 'Password must be at least 6 characters' }, { status: 400 });
  }
  
  // Verify token
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error('[RESET-PASSWORD] Invalid token:', error.message);
    return NextResponse.json({ success: false, error: 'Invalid or expired token' }, { status: 400 });
  }
  
  if (decoded.type !== 'password_reset') {
    return NextResponse.json({ success: false, error: 'Invalid token type' }, { status: 400 });
  }
  
  const { userId, email } = decoded;
  const tokenEmailNorm = String(email || '').toLowerCase().trim();
  
  // Get Supabase client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !serviceKey) {
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
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
    return NextResponse.json({ success: false, error: 'Invalid or expired token' }, { status: 400 });
  }
  
  if (String(row.email || '').toLowerCase().trim() !== tokenEmailNorm) {
    console.error('[RESET-PASSWORD] Email mismatch for user', userId);
    return NextResponse.json({ success: false, error: 'Invalid or expired token' }, { status: 400 });
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
    return NextResponse.json(
      { success: false, error: 'Не удалось сохранить пароль. Попробуйте позже.' },
      { status: 500 }
    );
  }
  
  console.log('[RESET-PASSWORD] Password reset for:', user.email);
  
  return NextResponse.json({ 
    success: true, 
    message: 'Password has been reset successfully' 
  });
}

export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    endpoint: '/api/v2/auth/reset-password',
    method: 'POST',
    timestamp: new Date().toISOString()
  });
}
