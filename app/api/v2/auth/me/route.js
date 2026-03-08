/**
 * Gostaylo - Get Current User API
 * GET /api/v2/auth/me
 * 
 * Returns user from JWT session cookie
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'gostaylo-secret-key-change-in-production';

export async function GET() {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get('gostaylo_session');
  
  if (!sessionCookie?.value) {
    return NextResponse.json({ success: false, user: null }, { status: 401 });
  }
  
  // Verify JWT
  let decoded;
  try {
    decoded = jwt.verify(sessionCookie.value, JWT_SECRET);
  } catch (error) {
    return NextResponse.json({ success: false, user: null, error: 'Invalid session' }, { status: 401 });
  }
  
  // Get fresh user data from DB
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !serviceKey) {
    return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 });
  }
  
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  
  const { data: user, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', decoded.userId)
    .single();
  
  if (error || !user) {
    return NextResponse.json({ success: false, user: null }, { status: 401 });
  }
  
  const effectiveRole = user.last_name?.includes('[MODERATOR]') ? 'MODERATOR' : user.role;
  
  return NextResponse.json({ 
    success: true,
    user: {
      id: user.id,
      email: user.email,
      role: effectiveRole,
      firstName: user.first_name,
      lastName: user.last_name?.replace(' [MODERATOR]', '') || '',
      name: `${user.first_name || ''} ${user.last_name?.replace(' [MODERATOR]', '') || ''}`.trim(),
      referralCode: user.referral_code,
      isVerified: user.is_verified,
      preferredCurrency: user.preferred_currency
    }
  });
}
