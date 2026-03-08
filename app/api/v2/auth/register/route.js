/**
 * Gostaylo - Auth Register API (v2)
 * POST /api/v2/auth/register
 * 
 * Security: bcrypt password hashing
 * Default role: RENTER (all new signups)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

// Lazy import NotificationService to avoid build issues
async function sendWelcomeEmail(user) {
  try {
    const { NotificationService, NotificationEvents } = await import('@/lib/services/notification.service');
    await NotificationService.dispatch(NotificationEvents.USER_WELCOME, {
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        referral_code: user.referral_code
      }
    });
    console.log('[REGISTER] Welcome email sent');
    return true;
  } catch (error) {
    console.error('[REGISTER] Welcome email failed:', error.message);
    return false;
  }
}

export async function POST(request) {
  const timestamp = new Date().toISOString();
  console.log(`[REGISTER] ====== START ${timestamp} ======`);
  
  // 1. Check env vars
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
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
  
  const { email, password, firstName, lastName, phone, referredBy } = body;
  
  // 4. Validation
  if (!email) {
    return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 });
  }
  
  if (!password || password.length < 6) {
    return NextResponse.json({ success: false, error: 'Password must be at least 6 characters' }, { status: 400 });
  }
  
  // 5. Check existing user
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email.toLowerCase())
    .maybeSingle();
  
  if (existing) {
    return NextResponse.json({ success: false, error: 'Email already registered' }, { status: 400 });
  }
  
  // 6. Hash password with bcrypt (10 rounds)
  const passwordHash = await bcrypt.hash(password, 10);
  console.log('[REGISTER] Password hashed');
  
  // 7. Generate IDs
  const profileId = `user-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;
  const refCode = `GS${Math.floor(10000 + Math.random() * 90000)}`;
  
  // 8. Insert user (FORCE role: RENTER for all new signups)
  const { data: user, error } = await supabase
    .from('profiles')
    .insert({
      id: profileId,
      email: email.toLowerCase(),
      password_hash: passwordHash,
      role: 'RENTER', // SECURITY: Always RENTER for new signups
      first_name: firstName || null,
      last_name: lastName || null,
      phone: phone || null,
      referral_code: refCode,
      referred_by: referredBy || null,
      is_verified: true,
      verification_status: 'VERIFIED',
      preferred_currency: 'THB',
      language: 'ru'
    })
    .select('id, email, role, first_name, last_name, referral_code')
    .single();
  
  if (error) {
    console.error('[REGISTER] DB Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      code: error.code,
      hint: error.hint
    }, { status: 500 });
  }
  
  console.log('[REGISTER] User created:', user.id);
  
  // 9. Handle referral (non-blocking)
  if (referredBy) {
    try {
      const { data: referrer } = await supabase
        .from('profiles')
        .select('id')
        .eq('referral_code', referredBy)
        .single();
      
      if (referrer) {
        await supabase.from('referrals').insert({
          referrer_id: referrer.id,
          referred_id: user.id
        });
        console.log('[REGISTER] Referral recorded');
      }
    } catch (refErr) {
      console.error('[REGISTER] Referral error:', refErr.message);
    }
  }
  
  // 10. Send welcome email (NON-BLOCKING - registration succeeds even if email fails)
  sendWelcomeEmail(user);
  
  // 11. Return success with redirect
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
    },
    redirectTo: '/' // New users go to home
  });
}

export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    endpoint: '/api/v2/auth/register',
    method: 'POST',
    timestamp: new Date().toISOString()
  });
}
