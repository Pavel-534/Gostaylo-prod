/**
 * FunnyRent 2.1 - Partner Dashboard
 * Quick overview for partners
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, Calendar, MessageSquare, DollarSign, 
  TrendingUp, Clock, CheckCircle, AlertCircle, Plus 
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default function PartnerDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      if (!supabaseUrl || !supabaseKey) return;
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch partner stats
      const res = await fetch(`/api/v2/partner/stats?partnerId=${user.id}`);
      const data = await res.json();
      
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('[PARTNER STATS]', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pt-12">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Partner Dashboard</h1>
            <p className="text-slate-600">Manage your listings and bookings</p>
          </div>
          <Link href="/partner/listings/new">
            <Button className="bg-teal-600 hover:bg-teal-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Listing
            </Button>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Total Listings</CardTitle>
              <Building2 className="h-4 w-4 text-teal-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.listingsCount || 0}</div>
              <p className="text-xs text-slate-500">{stats?.activeListings || 0} active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Pending Bookings</CardTitle>
              <Clock className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{stats?.pendingBookings || 0}</div>
              <p className="text-xs text-slate-500">Awaiting confirmation</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">This Month Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                ฿{(stats?.monthlyRevenue || 0).toLocaleString()}
              </div>
              <p className="text-xs text-slate-500">Net after commission</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Unread Messages</CardTitle>
              <MessageSquare className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats?.unreadMessages || 0}</div>
              <p className="text-xs text-slate-500">From guests</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/partner/listings">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-6">
                <Building2 className="h-8 w-8 text-teal-600 mb-2" />
                <h3 className="font-semibold">My Listings</h3>
                <p className="text-sm text-slate-600">Manage your properties</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/partner/bookings">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-6">
                <Calendar className="h-8 w-8 text-amber-600 mb-2" />
                <h3 className="font-semibold">Bookings</h3>
                <p className="text-sm text-slate-600">View and manage reservations</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/partner/messages">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-6">
                <MessageSquare className="h-8 w-8 text-blue-600 mb-2" />
                <h3 className="font-semibold">Messages</h3>
                <p className="text-sm text-slate-600">Chat with guests</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
