/**
 * FunnyRent 2.1 - Auth API (v2)
 * POST /api/v2/auth/login - User login
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password } = body;
    
    if (!email) {
      return NextResponse.json({ 
        success: false, 
        error: 'Email is required' 
      }, { status: 400 });
    }
    
    // Find user by email
    const { data: user, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();
    
    if (error || !user) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 });
    }
    
    // In production: verify password hash
    // For now: mock authentication
    
    // Update last login
    await supabaseAdmin
      .from('profiles')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id);
    
    // Transform user for response
    // Check if this is a MODERATOR (marked in last_name)
    const isModerator = user.last_name?.includes('[MODERATOR]');
    const cleanLastName = user.last_name?.replace(' [MODERATOR]', '') || '';
    
    const userData = {
      id: user.id,
      email: user.email,
      role: isModerator ? 'MODERATOR' : user.role,
      firstName: user.first_name,
      lastName: cleanLastName,
      name: `${user.first_name || ''} ${cleanLastName}`.trim(),
      referralCode: user.referral_code,
      isVerified: user.is_verified,
      verificationStatus: user.verification_status,
      preferredCurrency: user.preferred_currency,
      notificationPreferences: user.notification_preferences,
      isModerator
    };
    
    console.log(`[AUTH] User logged in: ${email} (${user.role})`);
    
    return NextResponse.json({ 
      success: true, 
      user: userData
    });
    
  } catch (error) {
    console.error('[AUTH LOGIN ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
