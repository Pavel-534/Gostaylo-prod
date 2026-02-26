/**
 * FunnyRent 2.1 - Profile API (v2)
 * GET /api/v2/profile - Get user profile
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'userId is required' 
      }, { status: 400 });
    }
    
    const { data: user, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error || !user) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 });
    }
    
    // Transform for frontend
    const transformed = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      phone: user.phone,
      isVerified: user.is_verified,
      verificationStatus: user.verification_status,
      referralCode: user.referral_code,
      preferredCurrency: user.preferred_currency,
      customCommissionRate: user.custom_commission_rate,
      availableBalance: parseFloat(user.available_balance) || 0,
      escrowBalance: parseFloat(user.escrow_balance) || 0,
      telegramLinked: user.telegram_linked,
      notificationPreferences: user.notification_preferences,
      createdAt: user.created_at
    };
    
    return NextResponse.json({ success: true, data: transformed });
    
  } catch (error) {
    console.error('[PROFILE GET ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
