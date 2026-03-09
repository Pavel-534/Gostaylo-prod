/**
 * Gostaylo - Email Verification API
 * GET /api/v2/auth/verify?token=xxx
 * 
 * Verifies email, sets session cookie, redirects with success
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'gostaylo-secret-key-change-in-production';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.gostaylo.com';

export async function GET(request) {
  console.log('[VERIFY] ====== START ======');
  
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  
  if (!token) {
    console.log('[VERIFY] Missing token');
    return NextResponse.redirect(`${BASE_URL}/?auth_error=missing_token`);
  }
  
  // Verify JWT token
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
    console.log('[VERIFY] Token decoded:', decoded.userId, decoded.email);
  } catch (error) {
    console.error('[VERIFY] Invalid token:', error.message);
    return NextResponse.redirect(`${BASE_URL}/?auth_error=invalid_or_expired_token`);
  }
  
  if (decoded.type !== 'email_verification') {
    console.error('[VERIFY] Wrong token type:', decoded.type);
    return NextResponse.redirect(`${BASE_URL}/?auth_error=invalid_token_type`);
  }
  
  const { userId, email } = decoded;
  
  // Get Supabase client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !serviceKey) {
    console.error('[VERIFY] Missing DB config');
    return NextResponse.redirect(`${BASE_URL}/?auth_error=server_error`);
  }
  
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  
  // Update user verification status
  console.log('[VERIFY] Updating user:', userId);
  
  const { data: user, error } = await supabase
    .from('profiles')
    .update({
      is_verified: true,
      verification_status: 'VERIFIED',
      email_verified_at: new Date().toISOString()
    })
    .eq('id', userId)
    .eq('email', email.toLowerCase())
    .select('id, email, role, first_name, last_name, referral_code, preferred_currency')
    .single();
  
  if (error) {
    console.error('[VERIFY] DB Error:', error.message, error.code);
    return NextResponse.redirect(`${BASE_URL}/?auth_error=verification_failed`);
  }
  
  if (!user) {
    console.error('[VERIFY] User not found');
    return NextResponse.redirect(`${BASE_URL}/?auth_error=user_not_found`);
  }
  
  console.log('[VERIFY] SUCCESS! User verified:', user.email);
  
  // Generate session JWT (30 days)
  const sessionToken = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
  
  // Create redirect response with success message
  const response = NextResponse.redirect(`${BASE_URL}/?verified=success`);
  
  // Set HttpOnly session cookie (auto-login)
  response.cookies.set('gostaylo_session', sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/'
  });
  
  console.log('[VERIFY] Session cookie set, redirecting...');
  
  return response;
}
