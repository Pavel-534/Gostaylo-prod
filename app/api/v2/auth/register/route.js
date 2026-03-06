/**
 * Gostaylo - Auth Register API (v2) - SIMPLIFIED
 * POST /api/v2/auth/register - User registration
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin, getSupabaseStatus } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const timestamp = new Date().toISOString();
  console.log(`[REGISTER] ====== START ${timestamp} ======`);
  
  // 1. Check Supabase status
  const status = getSupabaseStatus();
  console.log('[REGISTER] Supabase status:', JSON.stringify(status));
  
  if (!supabaseAdmin) {
    console.error('[REGISTER] FATAL: supabaseAdmin is NULL');
    return NextResponse.json({ 
      success: false, 
      error: 'Database not configured',
      debug: status
    }, { status: 500 });
  }
  
  // 2. Parse request body
  let body;
  try {
    body = await request.json();
    console.log('[REGISTER] Body received:', JSON.stringify({ 
      email: body.email, 
      hasPassword: !!body.password,
      firstName: body.firstName,
      role: body.role 
    }));
  } catch (parseErr) {
    console.error('[REGISTER] Body parse error:', parseErr.message);
    return NextResponse.json({ 
      success: false, 
      error: 'Invalid JSON body',
      debug: parseErr.message
    }, { status: 400 });
  }
  
  const { email, password, firstName, lastName, phone, role = 'RENTER', referredBy } = body;
  
  // 3. Validate email
  if (!email) {
    return NextResponse.json({ 
      success: false, 
      error: 'Email is required' 
    }, { status: 400 });
  }
  
  // 4. Check if user exists
  try {
    console.log('[REGISTER] Checking existing user...');
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 = no rows found (which is good)
      console.error('[REGISTER] Check error:', checkError.message);
    }
    
    if (existing) {
      console.log('[REGISTER] User exists:', existing.id);
      return NextResponse.json({ 
        success: false, 
        error: 'Email already registered' 
      }, { status: 400 });
    }
  } catch (checkErr) {
    console.error('[REGISTER] Check exception:', checkErr.message);
  }
  
  // 5. Generate IDs
  const profileId = `user-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
  const referralCode = `GS${Math.floor(10000 + Math.random() * 90000)}`;
  
  // 6. Prepare minimal user data
  const userData = {
    id: profileId,
    email: email.toLowerCase(),
    password_hash: password ? `hashed_${password}` : null,
    first_name: firstName || null,
    last_name: lastName || null,
    phone: phone || null,
    role: role === 'PARTNER' ? 'PARTNER' : 'RENTER',
    verification_status: role === 'PARTNER' ? 'PENDING' : 'VERIFIED',
    is_verified: role !== 'PARTNER',
    referred_by: referredBy || null,
    preferred_currency: 'THB',
    referral_code: referralCode,
    telegram_linked: false,
    balance_points: 0,
    balance_usdt: 0,
    escrow_balance: 0,
    available_balance: 0,
    min_stay: 1,
    max_stay: 90,
    instant_booking: false,
    notification_preferences: { email: true, telegram: false },
    language: 'ru'
  };
  
  console.log('[REGISTER] Inserting user:', profileId);
  
  // 7. Insert to database
  try {
    const { data: user, error: insertError } = await supabaseAdmin
      .from('profiles')
      .insert(userData)
      .select()
      .single();
    
    if (insertError) {
      console.error('[REGISTER] INSERT ERROR:', {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint
      });
      return NextResponse.json({ 
        success: false, 
        error: insertError.message,
        code: insertError.code,
        hint: insertError.hint,
        details: insertError.details
      }, { status: 500 });
    }
    
    console.log('[REGISTER] SUCCESS! User created:', user.id);
    
    // 8. Return success (skip email for now)
    return NextResponse.json({ 
      success: true, 
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
        referralCode: user.referral_code,
        isVerified: user.is_verified,
        verificationStatus: user.verification_status
      }
    });
    
  } catch (insertException) {
    console.error('[REGISTER] INSERT EXCEPTION:', insertException.message, insertException.stack);
    return NextResponse.json({ 
      success: false, 
      error: insertException.message,
      stack: insertException.stack?.substring(0, 500)
    }, { status: 500 });
  }
}

// GET handler for health check
export async function GET() {
  const status = getSupabaseStatus();
  return NextResponse.json({ 
    status: 'ok',
    endpoint: '/api/v2/auth/register',
    method: 'POST required',
    supabase: status,
    timestamp: new Date().toISOString()
  });
}
