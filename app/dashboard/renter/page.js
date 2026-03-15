/**
 * Gostaylo - Renter Dashboard (v2)
 * 
 * Features:
 * - TanStack Query for data fetching
 * - Real-time stats from Supabase
 * - Shimmer loading skeletons
 * - Teal-600 aesthetic
 * 
 * @version 2.0 (v2 Architecture)
 */

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Home, Calendar, MessageSquare, Heart, 
  Search, Clock, CheckCircle, MapPin, 
  Loader2, TrendingUp, ArrowRight
} from 'lucide-react'
import { format } from 'date-fns'
import { useRecentlyViewed } from '@/lib/hooks/use-recently-viewed'

// Fetch renter bookings
async function fetchRenterBookings(renterId) {
  if (!renterId) throw new Error('No renter ID provided')
  
  const res = await fetch(`/api/v2/bookings?renterId=${renterId}&limit=50`, {
    cache: 'no-store'
  })
  
  if (!res.ok) {
    throw new Error('Failed to fetch bookings')
  }
  
  const data = await res.json()
  return data
}

// Shimmer skeleton component
function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="h-4 w-24 bg-slate-200 animate-pulse rounded" />
        <div className="h-4 w-4 bg-slate-200 animate-pulse rounded" />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-16 bg-slate-200 animate-pulse rounded mb-2" />
        <div className="h-3 w-20 bg-slate-200 animate-pulse rounded" />
      </CardContent>
    </Card>
  )
}

function BookingCardSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg animate-pulse">
      <div className="w-20 h-20 bg-slate-200 rounded-lg" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-48 bg-slate-200 rounded" />
        <div className="h-3 w-32 bg-slate-200 rounded" />
        <div className="h-3 w-40 bg-slate-200 rounded" />
      </div>
      <div className="space-y-2">
        <div className="h-5 w-20 bg-slate-200 rounded" />
        <div className="h-4 w-16 bg-slate-200 rounded" />
      </div>
    </div>
  )
}

export default function RenterDashboard() {
  const [userId, setUserId] = useState(null)
  const { recentListings } = useRecentlyViewed()

  // Get user ID from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem('gostaylo_user')
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser)
        setUserId(user.id)
      } catch (e) {
        console.error('[DASHBOARD] Failed to parse user', e)
      }
    }
  }, [])

  // Fetch bookings with TanStack Query
  const { 
    data, 
    isLoading, 
    isError, 
    error 
  } = useQuery({
    queryKey: ['renter-bookings', userId],
    queryFn: () => fetchRenterBookings(userId),
    enabled: !!userId,
    staleTime: 60 * 1000,
    select: (response) => response.data || []
  })

  const bookings = data || []

  // Calculate stats
  const stats = {
    total: bookings.length,
    active: bookings.filter(b => ['CONFIRMED', 'PAID', 'PAID_ESCROW'].includes(b.status)).length,
    pending: bookings.filter(b => b.status === 'PENDING').length,
    completed: bookings.filter(b => b.status === 'COMPLETED').length
  }

  // Recent bookings (last 5)
  const recentBookings = bookings.slice(0, 5)

  // Status colors
  const STATUS_COLORS = {
    PENDING: 'bg-amber-100 text-amber-800',
    CONFIRMED: 'bg-blue-100 text-blue-800',
    PAID: 'bg-green-100 text-green-800',
    PAID_ESCROW: 'bg-teal-100 text-teal-800',
    COMPLETED: 'bg-slate-100 text-slate-800',
    CANCELLED: 'bg-red-100 text-red-800'
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Dashboard</h1>
          <p className="text-slate-600 mt-1">Welcome back! Here's your activity.</p>
        </div>
        <Link href="/listings">
          <Button className="bg-teal-600 hover:bg-teal-700">
            <Search className="h-4 w-4 mr-2" />
            Browse Listings
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading || !userId ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <Card className="border-l-4 border-l-teal-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Total Bookings</CardTitle>
                <Calendar className="h-4 w-4 text-teal-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">{stats.total}</div>
                <p className="text-xs text-slate-500 mt-1">All time</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Active Trips</CardTitle>
                <Home className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{stats.active}</div>
                <p className="text-xs text-slate-500 mt-1">Confirmed & paid</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-amber-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Pending</CardTitle>
                <Clock className="h-4 w-4 text-amber-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-amber-600">{stats.pending}</div>
                <p className="text-xs text-slate-500 mt-1">Awaiting confirmation</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-slate-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Completed</CardTitle>
                <CheckCircle className="h-4 w-4 text-slate-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">{stats.completed}</div>
                <p className="text-xs text-slate-500 mt-1">Past trips</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Recent Bookings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Bookings</CardTitle>
          {bookings.length > 0 && (
            <Link href="/renter/bookings">
              <Button variant="ghost" size="sm" className="text-teal-600 hover:text-teal-700">
                View all
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          )}
        </CardHeader>
        <CardContent>
          {isLoading || !userId ? (
            <div className="space-y-4">
              <BookingCardSkeleton />
              <BookingCardSkeleton />
              <BookingCardSkeleton />
            </div>
          ) : isError ? (
            <div className="text-center py-8 text-red-600">
              <p className="mb-2">Failed to load bookings</p>
              <p className="text-sm text-slate-500">{error?.message}</p>
            </div>
          ) : recentBookings.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Calendar className="h-16 w-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">No bookings yet</h3>
              <p className="mb-6">Start exploring luxury properties in Phuket</p>
              <Link href="/listings">
                <Button className="bg-teal-600 hover:bg-teal-700">
                  Browse Properties
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {recentBookings.map((booking) => (
                <Link key={booking.id} href={`/checkout/${booking.id}`}>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 bg-slate-200 rounded-lg overflow-hidden flex-shrink-0">
                        {booking.listing?.images?.[0] && (
                          <img 
                            src={booking.listing.images[0]} 
                            alt={booking.listing?.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        )}
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900 group-hover:text-teal-600 transition-colors">
                          {booking.listing?.title || 'Listing'}
                        </h4>
                        <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                          <MapPin className="h-3 w-3" />
                          {booking.listing?.district || 'Phuket'}
                        </div>
                        <p className="text-sm text-slate-500 mt-1">
                          {booking.check_in && format(new Date(booking.check_in), 'MMM d')} → {booking.check_out && format(new Date(booking.check_out), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className={STATUS_COLORS[booking.status] || 'bg-slate-100'}>
                        {booking.status}
                      </Badge>
                      <p className="text-sm font-semibold text-slate-900 mt-2">
                        ฿{booking.total_price_thb?.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recently Viewed */}
      {recentListings.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-teal-600" />
                Recently Viewed
              </CardTitle>
              <Link href="/listings">
                <Button variant="ghost" size="sm" className="text-teal-600 hover:text-teal-700">
                  Browse More
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-6 px-6">
              <div className="flex gap-4 pb-2">
                {recentListings.slice(0, 5).map((listing) => (
                  <Link 
                    key={listing.id} 
                    href={`/listings/${listing.id}`}
                    className="flex-shrink-0 w-64 group"
                  >
                    <div className="bg-slate-50 rounded-lg overflow-hidden hover:shadow-md transition-all">
                      <div className="aspect-[4/3] overflow-hidden bg-slate-200">
                        <img
                          src={listing.cover_image || listing.images?.[0] || '/placeholder.jpg'}
                          alt={listing.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <div className="p-3">
                        <h4 className="font-semibold text-slate-900 line-clamp-1 text-sm group-hover:text-teal-600 transition-colors">
                          {listing.title}
                        </h4>
                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                          <MapPin className="h-3 w-3" />
                          {listing.district}
                        </div>
                        <p className="text-sm font-semibold text-slate-900 mt-2">
                          ฿{listing.base_price_thb?.toLocaleString()}
                          <span className="text-xs text-slate-500 font-normal"> / night</span>
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/renter/bookings">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-teal-100 hover:border-teal-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <Calendar className="h-8 w-8 text-teal-600" />
                <h3 className="font-semibold text-slate-900">My Bookings</h3>
              </div>
              <p className="text-sm text-slate-600">View all reservations</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/renter/messages">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-blue-100 hover:border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <MessageSquare className="h-8 w-8 text-blue-600" />
                <h3 className="font-semibold text-slate-900">Messages</h3>
              </div>
              <p className="text-sm text-slate-600">Chat with hosts</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/renter/favorites">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-red-100 hover:border-red-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <Heart className="h-8 w-8 text-red-500" />
                <h3 className="font-semibold text-slate-900">Favorites</h3>
              </div>
              <p className="text-sm text-slate-600">Saved properties</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
