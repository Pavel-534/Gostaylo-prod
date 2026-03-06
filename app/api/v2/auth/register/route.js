/**
 * Gostaylo - Auth Register API (v2) - ATOMIC VERSION
 * POST /api/v2/auth/register
 * Minimal insert to debug schema issues
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const timestamp = new Date().toISOString();
  console.log(`[REGISTER] ====== START ${timestamp} ======`);
  
  // 1. Check env vars (log first 10 chars only for security)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  console.log('[REGISTER] ENV CHECK:', {
    url: url ? `${url.substring(0, 30)}...` : 'MISSING',
    serviceKey: serviceKey ? `${serviceKey.substring(0, 10)}...` : 'MISSING'
  });
  
  if (!url || !serviceKey) {
    return NextResponse.json({ 
      success: false, 
      error: 'Missing environment variables',
      debug: {
        hasUrl: !!url,
        hasServiceKey: !!serviceKey
      }
    }, { status: 500 });
  }
  
  // 2. Create fresh Supabase client
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  
  console.log('[REGISTER] Supabase client created');
  
  // 3. Parse request body
  let body;
  try {
    body = await request.json();
    console.log('[REGISTER] Body:', JSON.stringify(body));
  } catch (parseErr) {
    return NextResponse.json({ 
      success: false, 
      error: 'Invalid JSON body',
      details: parseErr.message
    }, { status: 400 });
  }
  
  const { email, password, firstName, lastName, phone, role = 'RENTER' } = body;
  
  if (!email) {
    return NextResponse.json({ 
      success: false, 
      error: 'Email is required' 
    }, { status: 400 });
  }
  
  // 4. Check if user exists
  console.log('[REGISTER] Checking existing user...');
  const { data: existing, error: checkError } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('email', email.toLowerCase())
    .maybeSingle();
  
  if (checkError) {
    console.error('[REGISTER] Check error:', checkError);
  }
  
  if (existing) {
    return NextResponse.json({ 
      success: false, 
      error: 'Email already registered',
      existingId: existing.id
    }, { status: 400 });
  }
  
  // 5. Generate minimal IDs
  const profileId = `user-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;
  const refCode = `GS${Math.floor(10000 + Math.random() * 90000)}`;
  
  // 6. ATOMIC INSERT - Only essential fields
  // Start with absolute minimum, then add fields one by one
  const insertData = {
    id: profileId,
    email: email.toLowerCase(),
    role: role === 'PARTNER' ? 'PARTNER' : 'RENTER',
    first_name: firstName || null,
    last_name: lastName || null,
    referral_code: refCode,
    is_verified: true,
    verification_status: 'VERIFIED'
  };
  
  console.log('[REGISTER] INSERT DATA:', JSON.stringify(insertData, null, 2));
  
  // 7. Attempt insert
  const { data: user, error: insertError } = await supabase
    .from('profiles')
    .insert(insertData)
    .select('id, email, role, first_name, last_name, referral_code')
    .single();
  
  // 8. Handle error with FULL details
  if (insertError) {
    console.error('[REGISTER] INSERT FAILED:', JSON.stringify(insertError, null, 2));
    return NextResponse.json({ 
      success: false, 
      error: insertError.message,
      code: insertError.code,
      details: insertError.details,
      hint: insertError.hint,
      // Return what we tried to insert for debugging
      attemptedInsert: insertData
    }, { status: 500 });
  }
  
  console.log('[REGISTER] SUCCESS:', user.id);
  
  // 9. Return success
  return NextResponse.json({ 
    success: true, 
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
      referralCode: user.referral_code,
      isVerified: true,
      verificationStatus: 'VERIFIED'
    }
  });
}

// GET - Health check with schema test
export async function GET(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !serviceKey) {
    return NextResponse.json({ 
      status: 'error',
      error: 'Missing env vars',
      hasUrl: !!url,
      hasServiceKey: !!serviceKey
    }, { status: 500 });
  }
  
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  
  // Test query to check connection and get table structure
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, role, first_name')
    .limit(1);
  
  if (error) {
    return NextResponse.json({ 
      status: 'db_error',
      error: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    }, { status: 500 });
  }
  
  return NextResponse.json({ 
    status: 'ok',
    endpoint: '/api/v2/auth/register',
    method: 'POST required',
    dbConnection: 'OK',
    sampleUser: data?.[0] ? { id: data[0].id, email: data[0].email } : null,
    timestamp: new Date().toISOString()
  });
}
