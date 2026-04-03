/**
 * GoStayLo - Email Verification API
 * GET /api/v2/auth/verify?token=xxx
 * 
 * Verifies email, sets session cookie, redirects with success
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { getPublicSiteUrl } from '@/lib/site-url.js';
import { getJwtSecret } from '@/lib/auth/jwt-secret';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  let jwtSecret;
  try {
    jwtSecret = getJwtSecret();
  } catch (e) {
    console.error('[VERIFY]', e.message);
    const siteBase = getPublicSiteUrl();
    return NextResponse.redirect(`${siteBase}/?auth_error=server_error`);
  }

  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  
  const siteBase = getPublicSiteUrl()

  if (!token) {
    return NextResponse.redirect(`${siteBase}/?auth_error=missing_token`);
  }
  
  // Verify JWT token
  let decoded;
  try {
    decoded = jwt.verify(token, jwtSecret);
  } catch (error) {
    console.error('[VERIFY] Invalid token:', error.message);
    return NextResponse.redirect(`${siteBase}/?auth_error=invalid_or_expired_token`);
  }
  
  if (decoded.type !== 'email_verification') {
    console.error('[VERIFY] Wrong token type:', decoded.type);
    return NextResponse.redirect(`${siteBase}/?auth_error=invalid_token_type`);
  }
  
  const { userId, email } = decoded;
  
  // Get Supabase client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !serviceKey) {
    console.error('[VERIFY] Missing DB config');
    return NextResponse.redirect(`${siteBase}/?auth_error=server_error`);
  }
  
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  
  // Update user verification status
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
    return NextResponse.redirect(`${siteBase}/?auth_error=verification_failed`);
  }
  
  if (!user) {
    console.error('[VERIFY] User not found');
    return NextResponse.redirect(`${siteBase}/?auth_error=user_not_found`);
  }
  
  const role = String(user.role || 'RENTER').toUpperCase();

  // Generate session JWT (30 days)
  const sessionToken = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role,
      firstName: user.first_name
    },
    jwtSecret,
    { expiresIn: '30d' }
  );
  
  // Create redirect response with success message
  const response = NextResponse.redirect(`${siteBase}/?verified=success`);

  const secureCookie =
    process.env.NODE_ENV === 'production' || process.env.FORCE_SECURE_COOKIES === 'true'
  response.cookies.set('gostaylo_session', sessionToken, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
  
  return response;
}
