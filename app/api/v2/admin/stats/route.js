/**
 * FunnyRent 2.1 - Admin Stats API (v2)
 * GET /api/v2/admin/stats - Dashboard statistics
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request) {
  try {
    // Get user counts by role
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('role');
    
    const userCounts = {
      total: profiles?.length || 0,
      partners: profiles?.filter(p => p.role === 'PARTNER').length || 0,
      renters: profiles?.filter(p => p.role === 'RENTER').length || 0,
      admins: profiles?.filter(p => p.role === 'ADMIN').length || 0
    };
    
    // Get listing counts
    const { data: listings } = await supabaseAdmin
      .from('listings')
      .select('status, category_id');
    
    const listingCounts = {
      total: listings?.length || 0,
      active: listings?.filter(l => l.status === 'ACTIVE').length || 0,
      pending: listings?.filter(l => l.status === 'PENDING').length || 0
    };
    
    // Get booking stats
    const { data: bookings } = await supabaseAdmin
      .from('bookings')
      .select('status, price_thb, commission_thb, created_at');
    
    const bookingStats = {
      total: bookings?.length || 0,
      pending: bookings?.filter(b => b.status === 'PENDING').length || 0,
      confirmed: bookings?.filter(b => b.status === 'CONFIRMED').length || 0,
      paid: bookings?.filter(b => b.status === 'PAID').length || 0,
      completed: bookings?.filter(b => b.status === 'COMPLETED').length || 0
    };
    
    // Calculate revenue
    const completedBookings = bookings?.filter(b => ['PAID', 'COMPLETED'].includes(b.status)) || [];
    const totalRevenue = completedBookings.reduce((sum, b) => sum + parseFloat(b.price_thb || 0), 0);
    const totalCommission = completedBookings.reduce((sum, b) => sum + parseFloat(b.commission_thb || 0), 0);
    
    // Monthly revenue (last 6 months)
    const monthlyRevenue = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = month.toISOString().slice(0, 7);
      const monthName = month.toLocaleDateString('ru-RU', { month: 'short' });
      
      const monthBookings = completedBookings.filter(b => 
        b.created_at?.startsWith(monthStr)
      );
      
      monthlyRevenue.push({
        month: monthName,
        revenue: monthBookings.reduce((sum, b) => sum + parseFloat(b.price_thb || 0), 0)
      });
    }
    
    // Category revenue
    const { data: categories } = await supabaseAdmin
      .from('categories')
      .select('id, name');
    
    const categoryRevenue = categories?.map(cat => {
      const catListings = listings?.filter(l => l.category_id === cat.id).map(l => l.id) || [];
      const catBookings = bookings?.filter(b => catListings.includes(b.listing_id)) || [];
      const revenue = catBookings.reduce((sum, b) => sum + parseFloat(b.price_thb || 0), 0);
      
      return {
        name: cat.name,
        revenue,
        percentage: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 100) : 0
      };
    }) || [];
    
    // Get system settings
    const { data: settings } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'general')
      .single();
    
    return NextResponse.json({
      success: true,
      data: {
        users: userCounts,
        listings: listingCounts,
        bookings: bookingStats,
        revenue: {
          total: totalRevenue,
          commission: totalCommission,
          partnerEarnings: totalRevenue - totalCommission
        },
        monthlyRevenue,
        categoryRevenue,
        settings: settings?.value || {}
      }
    });
    
  } catch (error) {
    console.error('[ADMIN STATS ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
