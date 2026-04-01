/**
 * GoStayLo - Renter "My Bookings" Page (v2)
 * 
 * Features:
 * - TanStack Query for data fetching
 * - Real user ID from localStorage
 * - Status filters: "Upcoming", "Past", "Cancelled"
 * - GostayloListingCard component
 * - Shimmer loading skeletons
 * 
 * @version 2.0 (v2 Architecture)
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProxiedImage } from '@/components/proxied-image'
import { 
  Calendar, MapPin, Loader2, ArrowLeft, 
  CreditCard, Clock, CheckCircle, XCircle,
  AlertCircle, Home, Star
} from 'lucide-react'
import { format, parseISO, isPast, isFuture } from 'date-fns'
import { ru } from 'date-fns/locale'
import { formatPrice } from '@/lib/currency'
import { ReviewModal } from '@/components/review-modal'
import { toast } from 'sonner'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'

// Fetch renter bookings
async function fetchRenterBookings(renterId) {
  if (!renterId) throw new Error('No renter ID provided')
  
  const res = await fetch(`/api/v2/bookings?renterId=${renterId}&limit=100`, {
    cache: 'no-store'
  })
  
  if (!res.ok) {
    throw new Error('Failed to fetch bookings')
  }
  
  const data = await res.json()
  return data.data || []
}

// Shimmer skeleton
function BookingCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        <div className="w-full sm:w-48 h-48 sm:h-auto bg-slate-200 animate-pulse" />
        <div className="flex-1 p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <div className="h-6 w-64 bg-slate-200 animate-pulse rounded" />
              <div className="h-4 w-48 bg-slate-200 animate-pulse rounded" />
              <div className="h-4 w-56 bg-slate-200 animate-pulse rounded" />
            </div>
            <div className="h-6 w-20 bg-slate-200 animate-pulse rounded" />
          </div>
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="h-8 w-32 bg-slate-200 animate-pulse rounded" />
            <div className="h-10 w-28 bg-slate-200 animate-pulse rounded" />
          </div>
        </div>
      </div>
    </Card>
  )
}

// Status badge colors
const STATUS_CONFIG = {
  PENDING: { 
    bg: 'bg-amber-100', 
    text: 'text-amber-800', 
    border: 'border-amber-200',
    icon: Clock,
    label: 'Ожидает'
  },
  CONFIRMED: { 
    bg: 'bg-blue-100', 
    text: 'text-blue-800', 
    border: 'border-blue-200',
    icon: CheckCircle,
    label: 'Подтверждено'
  },
  PAID: { 
    bg: 'bg-green-100', 
    text: 'text-green-800', 
    border: 'border-green-200',
    icon: CheckCircle,
    label: 'Оплачено'
  },
  PAID_ESCROW: { 
    bg: 'bg-teal-100', 
    text: 'text-teal-800', 
    border: 'border-teal-200',
    icon: CheckCircle,
    label: 'Эскроу'
  },
  COMPLETED: { 
    bg: 'bg-slate-100', 
    text: 'text-slate-800', 
    border: 'border-slate-200',
    icon: CheckCircle,
    label: 'Завершено'
  },
  CANCELLED: { 
    bg: 'bg-red-100', 
    text: 'text-red-800', 
    border: 'border-red-200',
    icon: XCircle,
    label: 'Отменено'
  },
  DECLINED: { 
    bg: 'bg-red-100', 
    text: 'text-red-800', 
    border: 'border-red-200',
    icon: XCircle,
    label: 'Отклонено'
  },
}

// Status badge component
function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING
  const Icon = config.icon
  
  return (
    <Badge className={`${config.bg} ${config.text} border ${config.border} flex items-center gap-1`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  )
}

// Individual booking card
function BookingCard({ booking, onReviewClick }) {
  const router = useRouter()
  
  const checkInDate = booking.check_in ? parseISO(booking.check_in) : null
  const checkOutDate = booking.check_out ? parseISO(booking.check_out) : null
  const nights = checkInDate && checkOutDate 
    ? Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24))
    : 0
  
  // Handle both 'listing' and 'listings' (Supabase join returns 'listings')
  const listing = booking.listing || booking.listings || {}
  const listingImage = listing.images?.[0] || listing.cover_image || '/placeholder.svg'
  
  // Determine action button
  const getActionButton = () => {
    if (booking.status === 'CONFIRMED') {
      return (
        <Button 
          className="bg-teal-600 hover:bg-teal-700"
          onClick={() => router.push(`/checkout/${booking.id}`)}
        >
          <CreditCard className="h-4 w-4 mr-2" />
          Оплатить
        </Button>
      )
    }
    
    if (booking.status === 'PAID' || booking.status === 'PAID_ESCROW') {
      return (
        <Button 
          variant="outline"
          onClick={() => router.push(`/checkout/${booking.id}`)}
        >
          Детали
        </Button>
      )
    }
    
    if (booking.status === 'COMPLETED') {
      return (
        <Button 
          className="bg-teal-600 hover:bg-teal-700"
          onClick={() => onReviewClick(booking)}
        >
          <Star className="h-4 w-4 mr-2" />
          Leave a Review
        </Button>
      )
    }
    
    return null
  }
  
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
      <div className="flex flex-col sm:flex-row">
        {/* Image */}
        <div 
          className="relative w-full sm:w-48 h-48 bg-slate-100 flex-shrink-0 cursor-pointer overflow-hidden"
          onClick={() => router.push(`/listings/${listing.id}`)}
        >
          <ProxiedImage
            src={listingImage}
            alt={listing.title}
            fill
            className="object-cover hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, 192px"
          />
        </div>
        
        {/* Content */}
        <div className="flex-1 p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-slate-900 mb-2 hover:text-teal-600 transition-colors">
                {listing.title || 'Property'}
              </h3>
              
              <div className="space-y-1 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>{listing.district || 'Phuket'}, Thailand</span>
                </div>
                
                {checkInDate && checkOutDate && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {format(checkInDate, 'd MMM', { locale: ru })} - {format(checkOutDate, 'd MMM yyyy', { locale: ru })} ({nights} {nights === 1 ? 'ночь' : nights < 5 ? 'ночи' : 'ночей'})
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            <StatusBadge status={booking.status} />
          </div>
          
          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <div>
              <p className="text-sm text-slate-600 mb-1">Стоимость</p>
              <p className="text-2xl font-bold text-slate-900">
                {formatPrice(booking.total_price_thb || booking.price_thb || 0, 'THB')}
              </p>
            </div>
            
            {getActionButton()}
          </div>
          
          {/* Special info */}
          {booking.status === 'PENDING' && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <AlertCircle className="h-4 w-4 inline mr-2" />
                Ожидает подтверждения от владельца
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

export default function RenterBookingsPage() {
  const { language } = useI18n()
  const [userId, setUserId] = useState(null)
  const [activeTab, setActiveTab] = useState('all')
  const queryClient = useQueryClient()
  
  // Review modal state
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState(null)
  
  // Get user ID from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem('gostaylo_user')
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser)
        setUserId(user.id)
      } catch (e) {
        console.error('[BOOKINGS] Failed to parse user', e)
      }
    }
  }, [])
  
  // Fetch bookings with TanStack Query
  const { 
    data: bookings = [], 
    isLoading, 
    isError, 
    error 
  } = useQuery({
    queryKey: ['renter-bookings', userId],
    queryFn: () => fetchRenterBookings(userId),
    enabled: !!userId,
    staleTime: 60 * 1000,
  })
  
  // Filter bookings by tab
  const filteredBookings = useMemo(() => {
    if (activeTab === 'all') return bookings
    
    if (activeTab === 'upcoming') {
      return bookings.filter(b => {
        const checkIn = b.check_in ? parseISO(b.check_in) : null
        return checkIn && isFuture(checkIn) && ['CONFIRMED', 'PAID', 'PAID_ESCROW'].includes(b.status)
      })
    }
    
    if (activeTab === 'past') {
      return bookings.filter(b => {
        const checkOut = b.check_out ? parseISO(b.check_out) : null
        return (checkOut && isPast(checkOut)) || b.status === 'COMPLETED'
      })
    }
    
    if (activeTab === 'cancelled') {
      return bookings.filter(b => ['CANCELLED', 'DECLINED'].includes(b.status))
    }
    
    return bookings
  }, [bookings, activeTab])
  
  // Count badges
  const counts = useMemo(() => {
    return {
      all: bookings.length,
      upcoming: bookings.filter(b => {
        const checkIn = b.check_in ? parseISO(b.check_in) : null
        return checkIn && isFuture(checkIn) && ['CONFIRMED', 'PAID', 'PAID_ESCROW'].includes(b.status)
      }).length,
      past: bookings.filter(b => {
        const checkOut = b.check_out ? parseISO(b.check_out) : null
        return (checkOut && isPast(checkOut)) || b.status === 'COMPLETED'
      }).length,
      cancelled: bookings.filter(b => ['CANCELLED', 'DECLINED'].includes(b.status)).length,
    }
  }, [bookings])
  
  // Submit review mutation
  const submitReviewMutation = useMutation({
    mutationFn: async ({ ratings, comment }) => {
      const res = await fetch('/api/v2/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          listingId: selectedBooking.listing_id,
          bookingId: selectedBooking.id,
          ratings,
          comment
        })
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to submit review')
      }
      
      return await res.json()
    },
    onSuccess: () => {
      toast.success(language === 'ru' ? 'Отзыв отправлен!' : 'Review submitted!')
      queryClient.invalidateQueries({ queryKey: ['renter-bookings', userId] })
    },
    onError: (error) => {
      toast.error(error.message)
    }
  })
  
  // Handle review click
  const handleReviewClick = (booking) => {
    setSelectedBooking(booking)
    setReviewModalOpen(true)
  }
  
  const handleReviewSubmit = async (reviewData) => {
    await submitReviewMutation.mutateAsync(reviewData)
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 pr-2">
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            {getUIText('myBookingsTitle', language)}
          </h1>
          <p className="text-slate-600 mt-1 text-sm sm:text-base">{getUIText('manageTrips', language)}</p>
        </div>
        <Link href="/listings" className="shrink-0 self-stretch sm:self-auto">
          <Button className="w-full bg-teal-600 hover:bg-teal-700 sm:w-auto">
            <Home className="h-4 w-4 mr-2" />
            {getUIText('findStay', language)}
          </Button>
        </Link>
      </div>
      
      {/* Tabs — horizontal scroll on narrow screens so labels + badges do not overlap */}
      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex h-auto w-full max-w-full flex-nowrap items-stretch justify-start gap-1 overflow-x-auto overflow-y-hidden rounded-lg bg-muted p-1 [scrollbar-width:none] lg:inline-grid lg:w-auto lg:grid-cols-4 lg:overflow-visible [&::-webkit-scrollbar]:hidden">
          <TabsTrigger
            value="all"
            className="shrink-0 flex-col gap-1 px-3 py-2 text-xs data-[state=active]:shadow-sm lg:flex-row lg:text-sm"
          >
            <span className="whitespace-nowrap">{getUIText('all', language)}</span>
            {counts.all > 0 && (
              <Badge variant="secondary" className="shrink-0 bg-teal-100 text-teal-700">
                {counts.all}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="upcoming"
            className="shrink-0 flex-col gap-1 px-3 py-2 text-xs data-[state=active]:shadow-sm lg:flex-row lg:text-sm"
          >
            <span className="whitespace-nowrap">{getUIText('upcoming', language)}</span>
            {counts.upcoming > 0 && (
              <Badge variant="secondary" className="shrink-0 bg-blue-100 text-blue-700">
                {counts.upcoming}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="past"
            className="shrink-0 flex-col gap-1 px-3 py-2 text-xs data-[state=active]:shadow-sm lg:flex-row lg:text-sm"
          >
            <span className="whitespace-nowrap">{getUIText('past', language)}</span>
            {counts.past > 0 && (
              <Badge variant="secondary" className="shrink-0 bg-slate-200 text-slate-700">
                {counts.past}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="cancelled"
            className="shrink-0 flex-col gap-1 px-3 py-2 text-xs data-[state=active]:shadow-sm lg:flex-row lg:text-sm"
          >
            <span className="whitespace-nowrap">{getUIText('cancelled', language)}</span>
            {counts.cancelled > 0 && (
              <Badge variant="secondary" className="shrink-0 bg-red-100 text-red-700">
                {counts.cancelled}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
        
        {/* Tab Content */}
        <TabsContent value={activeTab} className="mt-6">
          {isLoading || !userId ? (
            <div className="space-y-4">
              <BookingCardSkeleton />
              <BookingCardSkeleton />
              <BookingCardSkeleton />
            </div>
          ) : isError ? (
            <Card className="p-12">
              <div className="text-center">
                <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  {getUIText('loadError', language)}
                </h3>
                <p className="text-slate-600 mb-4">{error?.message}</p>
                <Button variant="outline" onClick={() => window.location.reload()}>
                  {getUIText('retry', language)}
                </Button>
              </div>
            </Card>
          ) : filteredBookings.length === 0 ? (
            <Card className="p-12">
              <div className="text-center">
                <Calendar className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  {activeTab === 'all' && getUIText('noBookings', language)}
                  {activeTab === 'upcoming' && getUIText('noUpcomingTrips', language)}
                  {activeTab === 'past' && getUIText('noPastTrips', language)}
                  {activeTab === 'cancelled' && getUIText('noCancelledBookings', language)}
                </h3>
                <p className="text-slate-600 mb-6">
                  {activeTab === 'all' && getUIText('startSearchingPhuket', language)}
                  {activeTab === 'upcoming' && getUIText('bookNextTrip', language)}
                  {activeTab === 'past' && getUIText('noCompletedTrips', language)}
                  {activeTab === 'cancelled' && getUIText('allBookingsActive', language)}
                </p>
                <Link href="/listings">
                  <Button className="bg-teal-600 hover:bg-teal-700">
                    {getUIText('findStay', language)}
                  </Button>
                </Link>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredBookings.map((booking) => (
                <BookingCard 
                  key={booking.id} 
                  booking={booking}
                  onReviewClick={handleReviewClick}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Review Modal */}
      <ReviewModal
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        booking={selectedBooking}
        onSubmit={handleReviewSubmit}
        isSubmitting={submitReviewMutation.isPending}
      />
    </div>
  )
}
