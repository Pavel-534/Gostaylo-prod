/**
 * Gostaylo - Renter Dashboard
 * Quick overview for renters/guests
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Home, Calendar, MessageSquare, Heart, 
  Search, Clock, CheckCircle, MapPin 
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default function RenterDashboard() {
  const [stats, setStats] = useState(null);
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      if (!supabaseUrl || !supabaseKey) return;
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch renter's bookings
      const res = await fetch(`/api/v2/bookings?renterId=${user.id}&limit=5`);
      const data = await res.json();
      
      if (data.success) {
        setRecentBookings(data.data || []);
        
        // Calculate stats
        const bookings = data.data || [];
        setStats({
          totalBookings: bookings.length,
          activeBookings: bookings.filter(b => ['CONFIRMED', 'PAID', 'PAID_ESCROW'].includes(b.status)).length,
          completedBookings: bookings.filter(b => b.status === 'COMPLETED').length,
          pendingBookings: bookings.filter(b => b.status === 'PENDING').length
        });
      }
    } catch (error) {
      console.error('[RENTER STATS]', error);
    } finally {
      setLoading(false);
    }
  }

  const STATUS_COLORS = {
    PENDING: 'bg-amber-100 text-amber-800',
    CONFIRMED: 'bg-blue-100 text-blue-800',
    PAID: 'bg-green-100 text-green-800',
    PAID_ESCROW: 'bg-teal-100 text-teal-800',
    COMPLETED: 'bg-slate-100 text-slate-800',
    CANCELLED: 'bg-red-100 text-red-800'
  };

  return (
    <div className="min-h-screen bg-slate-50 pt-12">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">My Dashboard</h1>
            <p className="text-slate-600">Welcome back! Here's your activity.</p>
          </div>
          <Link href="/listings">
            <Button className="bg-teal-600 hover:bg-teal-700">
              <Search className="h-4 w-4 mr-2" />
              Browse Listings
            </Button>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Total Bookings</CardTitle>
              <Calendar className="h-4 w-4 text-teal-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalBookings || 0}</div>
              <p className="text-xs text-slate-500">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Active Trips</CardTitle>
              <Home className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats?.activeBookings || 0}</div>
              <p className="text-xs text-slate-500">Confirmed & paid</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Pending</CardTitle>
              <Clock className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{stats?.pendingBookings || 0}</div>
              <p className="text-xs text-slate-500">Awaiting confirmation</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-slate-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.completedBookings || 0}</div>
              <p className="text-xs text-slate-500">Past trips</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Bookings */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Recent Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            {recentBookings.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Calendar className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                <p>No bookings yet</p>
                <Link href="/listings">
                  <Button variant="link" className="text-teal-600">Browse properties →</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {recentBookings.map((booking) => (
                  <Link key={booking.id} href={`/checkout/${booking.id}`}>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-slate-200 rounded-lg overflow-hidden">
                          {booking.listing?.images?.[0] && (
                            <img 
                              src={booking.listing.images[0]} 
                              alt={booking.listing?.title}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        <div>
                          <h4 className="font-semibold">{booking.listing?.title || 'Listing'}</h4>
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <MapPin className="h-3 w-3" />
                            {booking.listing?.district || 'Phuket'}
                          </div>
                          <p className="text-sm text-slate-500">
                            {booking.check_in} → {booking.check_out}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={STATUS_COLORS[booking.status] || 'bg-slate-100'}>
                          {booking.status}
                        </Badge>
                        <p className="text-sm font-semibold mt-1">฿{booking.price_thb?.toLocaleString()}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/renter/bookings">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-6">
                <Calendar className="h-8 w-8 text-teal-600 mb-2" />
                <h3 className="font-semibold">My Bookings</h3>
                <p className="text-sm text-slate-600">View all reservations</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/renter/messages">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-6">
                <MessageSquare className="h-8 w-8 text-blue-600 mb-2" />
                <h3 className="font-semibold">Messages</h3>
                <p className="text-sm text-slate-600">Chat with hosts</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/favorites">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-6">
                <Heart className="h-8 w-8 text-red-500 mb-2" />
                <h3 className="font-semibold">Favorites</h3>
                <p className="text-sm text-slate-600">Saved properties</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
