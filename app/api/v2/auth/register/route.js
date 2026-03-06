/**
 * Gostaylo - Auth Register API (v2)
 * POST /api/v2/auth/register - User registration
 * Creates profile in public.profiles table with TEXT ID
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { NotificationService, NotificationEvents } from '@/lib/services/notification.service';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  console.log('[API] ====== REGISTER REQUEST START ======');
  console.log('[API] Timestamp:', new Date().toISOString());
  console.log('[API] Request URL:', request.url);
  console.log('[API] Request method:', request.method);
  
  // CRITICAL: Check if supabaseAdmin is initialized
  if (!supabaseAdmin) {
    console.error('[FATAL] supabaseAdmin is NULL - SUPABASE_SERVICE_ROLE_KEY missing from environment!');
    return NextResponse.json({ 
      success: false, 
      error: 'Database connection not configured. Contact support.',
      debug: 'supabaseAdmin is null - check SUPABASE_SERVICE_ROLE_KEY env var'
    }, { status: 500 });
  }
  
  console.log('[API] supabaseAdmin: INITIALIZED');
  
  let body;
  try {
    body = await request.json();
    console.log('[API] Request body parsed:', JSON.stringify(body, null, 2));
  } catch (parseError) {
    console.error('[API] Failed to parse request body:', parseError.message);
    return NextResponse.json({ 
      success: false, 
      error: 'Invalid request body',
      debug: parseError.message
    }, { status: 400 });
  }
  
  try {
    const { email, password, firstName, lastName, phone, role = 'RENTER', referredBy } = body;
    
    console.log('[API] Register attempt for email:', email);
    console.log('[API] supabaseAdmin status:', supabaseAdmin ? 'OK' : 'NULL');
    
    if (!email) {
      return NextResponse.json({ 
        success: false, 
        error: 'Email is required' 
      }, { status: 400 });
    }
    
    // Check if user exists
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();
    
    if (existing) {
      return NextResponse.json({ 
        success: false, 
        error: 'Email already registered' 
      }, { status: 400 });
    }
    
    // Generate unique ID for profile
    const profileId = `user-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
    
    // Generate referral code (FR + 5 random digits)
    const referralCode = `FR${Math.floor(10000 + Math.random() * 90000)}`;
    
    // Prepare user data with ALL required fields to avoid constraint violations
    const userData = {
      id: profileId,
      email: email.toLowerCase(),
      password_hash: password ? 'hashed_' + password : null,
      first_name: firstName || null,
      last_name: lastName || null,
      phone: phone || null,
      role: role === 'PARTNER' ? 'PARTNER' : 'RENTER',
      verification_status: role === 'PARTNER' ? 'PENDING' : 'VERIFIED',
      is_verified: role !== 'PARTNER',
      referred_by: referredBy || null,
      preferred_currency: 'THB',
      referral_code: referralCode,
      // Explicit defaults for potentially NOT NULL columns
      telegram_linked: false,
      balance_points: 0,
      balance_usdt: 0,
      escrow_balance: 0,
      available_balance: 0,
      min_stay: 1,
      max_stay: 90,
      instant_booking: false,
      notification_preferences: { email: true, telegram: false, telegramChatId: null },
      language: 'ru'
    };
    
    console.log('[API] Inserting user with data:', JSON.stringify(userData, null, 2));
    
    // Create user with explicit field values
    const { data: user, error } = await supabaseAdmin
      .from('profiles')
      .insert(userData)
      .select()
      .single();
    
    if (error) {
      console.error('[DB INSERT ERROR]', error.code, error.message, error.details, error.hint);
      return NextResponse.json({ 
        success: false, 
        error: error.message,
        code: error.code,
        hint: error.hint 
      }, { status: 500 });
    }
    
    console.log('[API] User created successfully:', user?.id);
    
    // If referred, create referral record (non-blocking)
    if (referredBy) {
      try {
        const { data: referrer } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('referral_code', referredBy)
          .single();
        
        if (referrer) {
          await supabaseAdmin
            .from('referrals')
            .insert({
              referrer_id: referrer.id,
              referred_id: user.id
            });
        }
      } catch (refErr) {
        console.error('[REFERRAL ERROR]', refErr.message);
        // Non-blocking - continue with registration
      }
    }
    
    // Send welcome notification (NON-BLOCKING - don't fail registration if email fails)
    try {
      await NotificationService.dispatch(NotificationEvents.USER_WELCOME, {
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          referral_code: user.referral_code
        }
      });
      console.log('[API] Welcome notification sent');
    } catch (notifError) {
      console.error('[NOTIFICATION ERROR] Welcome email failed:', notifError.message);
      // Don't fail registration because of notification error
    }
    
    console.log(`[AUTH] New user registered: ${email} (${user.role}) - Referral: ${user.referral_code}`);
    
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
    
  } catch (error) {
    console.error('[AUTH REGISTER ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// GET handler for health check
export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    endpoint: '/api/v2/auth/register',
    method: 'POST required',
    timestamp: new Date().toISOString()
  });
}
