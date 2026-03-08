/**
 * Gostaylo - Email Verification API
 * GET /api/v2/auth/verify?token=xxx
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'gostaylo-secret-key-change-in-production';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.gostaylo.com';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  
  if (!token) {
    return NextResponse.redirect(`${BASE_URL}/?error=missing_token`);
  }
  
  // Verify JWT token
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error('[VERIFY] Invalid token:', error.message);
    return NextResponse.redirect(`${BASE_URL}/?error=invalid_token`);
  }
  
  if (decoded.type !== 'email_verification') {
    return NextResponse.redirect(`${BASE_URL}/?error=invalid_token_type`);
  }
  
  const { userId, email } = decoded;
  
  // Update user in database
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !serviceKey) {
    return NextResponse.redirect(`${BASE_URL}/?error=db_error`);
  }
  
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  
  const { data: user, error } = await supabase
    .from('profiles')
    .update({
      is_verified: true,
      verification_status: 'VERIFIED',
      email_verified_at: new Date().toISOString()
    })
    .eq('id', userId)
    .eq('email', email)
    .select()
    .single();
  
  if (error || !user) {
    console.error('[VERIFY] DB Error:', error);
    return NextResponse.redirect(`${BASE_URL}/?error=verification_failed`);
  }
  
  console.log('[VERIFY] Email verified for:', email);
  
  // Redirect to success page
  return NextResponse.redirect(`${BASE_URL}/?verified=true`);
}
