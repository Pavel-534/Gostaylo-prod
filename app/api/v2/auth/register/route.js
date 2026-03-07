/**
 * Gostaylo - Auth Register API (v2)
 * POST /api/v2/auth/register
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const timestamp = new Date().toISOString();
  console.log(`[REGISTER] ====== START ${timestamp} ======`);
  
  // 1. Check env vars
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  console.log('[REGISTER] ENV:', {
    url: url ? 'SET' : 'MISSING',
    key: serviceKey ? 'SET' : 'MISSING'
  });
  
  if (!url || !serviceKey) {
    return NextResponse.json({ 
      success: false, 
      error: 'Database not configured',
      env: { hasUrl: !!url, hasKey: !!serviceKey }
    }, { status: 500 });
  }
  
  // 2. Create Supabase client
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  
  // 3. Parse body
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }
  
  const { email, firstName, lastName, role = 'RENTER' } = body;
  
  if (!email) {
    return NextResponse.json({ success: false, error: 'Email required' }, { status: 400 });
  }
  
  // 4. Check existing
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email.toLowerCase())
    .maybeSingle();
  
  if (existing) {
    return NextResponse.json({ success: false, error: 'Email exists' }, { status: 400 });
  }
  
  // 5. Insert
  const profileId = `user-${Date.now().toString(36)}-${Math.random().toString(36).substring(2,5)}`;
  const refCode = `GS${Math.floor(10000 + Math.random() * 90000)}`;
  
  const { data: user, error } = await supabase
    .from('profiles')
    .insert({
      id: profileId,
      email: email.toLowerCase(),
      role: role === 'PARTNER' ? 'PARTNER' : 'RENTER',
      first_name: firstName || null,
      last_name: lastName || null,
      referral_code: refCode,
      is_verified: true,
      verification_status: 'VERIFIED'
    })
    .select('id, email, role, first_name, last_name, referral_code')
    .single();
  
  if (error) {
    console.error('[REGISTER] ERROR:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      code: error.code,
      hint: error.hint
    }, { status: 500 });
  }
  
  console.log('[REGISTER] OK:', user.id);
  
  return NextResponse.json({ 
    success: true, 
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
      referralCode: user.referral_code,
      isVerified: true
    }
  });
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  return NextResponse.json({ 
    status: 'ok',
    endpoint: '/api/v2/auth/register',
    env: { url: !!url, key: !!key },
    timestamp: new Date().toISOString()
  });
}
