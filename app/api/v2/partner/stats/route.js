/**
 * Gostaylo - Partner Stats API (v2)
 * GET /api/v2/partner/stats - Partner dashboard statistics
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { PaymentService } from '@/lib/services/payment.service';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get('partnerId');
    
    if (!partnerId) {
      return NextResponse.json({ 
        success: false, 
        error: 'partnerId is required' 
      }, { status: 400 });
    }
    
    // Get partner profile
    const { data: partner } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', partnerId)
      .single();
    
    if (!partner || partner.role !== 'PARTNER') {
      return NextResponse.json({ 
        success: false, 
        error: 'Partner not found' 
      }, { status: 404 });
    }
    
    // Get partner's listings
    const { data: listings } = await supabaseAdmin
      .from('listings')
      .select('id, title, status, views, bookings_count, rating')
      .eq('owner_id', partnerId);
    
    // Get partner's bookings
    const { data: bookings } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false });
    
    // Calculate balance
    const balance = await PaymentService.calculatePartnerBalance(partnerId);
    
    // Get referrals
    const { data: referrals } = await supabaseAdmin
      .from('referrals')
      .select('*, referred:profiles!referred_id(email, first_name)')
      .eq('referrer_id', partnerId);
    
    // Calculate stats
    const listingStats = {
      total: listings?.length || 0,
      active: listings?.filter(l => l.status === 'ACTIVE').length || 0,
      pending: listings?.filter(l => l.status === 'PENDING').length || 0,
      totalViews: listings?.reduce((sum, l) => sum + (l.views || 0), 0) || 0
    };
    
    const bookingStats = {
      total: bookings?.length || 0,
      pending: bookings?.filter(b => b.status === 'PENDING').length || 0,
      confirmed: bookings?.filter(b => b.status === 'CONFIRMED').length || 0,
      completed: bookings?.filter(b => ['PAID', 'COMPLETED'].includes(b.status)).length || 0
    };
    
    // Recent bookings
    const recentBookings = bookings?.slice(0, 5).map(b => ({
      id: b.id,
      status: b.status,
      checkIn: b.check_in,
      checkOut: b.check_out,
      priceThb: parseFloat(b.price_thb),
      guestName: b.guest_name,
      createdAt: b.created_at
    })) || [];
    
    return NextResponse.json({
      success: true,
      data: {
        partner: {
          id: partner.id,
          email: partner.email,
          name: `${partner.first_name || ''} ${partner.last_name || ''}`.trim(),
          isVerified: partner.is_verified,
          verificationStatus: partner.verification_status,
          referralCode: partner.referral_code,
          customCommissionRate: partner.custom_commission_rate
        },
        listings: listingStats,
        bookings: bookingStats,
        balance: {
          totalEarnings: balance.totalEarnings,
          availableBalance: balance.availableBalance,
          escrowBalance: balance.escrowBalance,
          pendingPayouts: balance.pendingPayouts,
          totalCommissionPaid: balance.totalCommission
        },
        referrals: {
          total: referrals?.length || 0,
          rewardPoints: referrals?.reduce((sum, r) => sum + parseFloat(r.reward_points || 0), 0) || 0,
          list: referrals?.map(r => ({
            email: r.referred?.email,
            name: r.referred?.first_name,
            rewardPaid: r.reward_paid,
            createdAt: r.created_at
          })) || []
        },
        recentBookings
      }
    });
    
  } catch (error) {
    console.error('[PARTNER STATS ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
