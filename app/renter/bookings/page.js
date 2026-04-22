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

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  AlertCircle, Home, Star, MessageSquare
} from 'lucide-react'
import { format, parseISO, isPast, isFuture } from 'date-fns'
import { listingDateToday } from '@/lib/listing-date'
import { ru } from 'date-fns/locale'
import { formatPrice } from '@/lib/currency'
import { getGuestPayableRoundedThb } from '@/lib/booking-guest-total'
import { ReviewModal } from '@/components/review-modal'
import { toast } from 'sonner'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { CancelBookingDialog } from '@/components/renter/cancel-booking-dialog'

function canRenterCancelBooking(status) {
  return !['CANCELLED', 'COMPLETED', 'REFUNDED', 'DECLINED'].includes(String(status || '').toUpperCase())
}

/** Вкладка списка, где видна бронь (для ?booking= из Telegram / push). */
function tabForBookingDeepLink(b) {
  if (!b) return 'all'
  if (['CANCELLED', 'DECLINED'].includes(b.status)) return 'cancelled'
  const checkOut = b.check_out ? parseISO(b.check_out) : null
  if ((checkOut && isPast(checkOut)) || b.status === 'COMPLETED') return 'past'
  const checkIn = b.check_in ? parseISO(b.check_in) : null
  if (
    checkIn &&
    isFuture(checkIn) &&
    ['CONFIRMED', 'AWAITING_PAYMENT', 'PAID', 'PAID_ESCROW', 'CHECKED_IN', 'THAWED'].includes(b.status)
  ) {
    return 'upcoming'
  }
  return 'all'
}

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

// Status badge colors (labels: getUIText `chatBookingStatus_*`)
const STATUS_CONFIG = {
  PENDING: {
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    border: 'border-amber-200',
    icon: Clock,
  },
  AWAITING_PAYMENT: {
    bg: 'bg-orange-100',
    text: 'text-orange-900',
    border: 'border-orange-200',
    icon: Clock,
  },
  CONFIRMED: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-200',
    icon: CheckCircle,
  },
  PAID: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-200',
    icon: CheckCircle,
  },
  PAID_ESCROW: {
    bg: 'bg-teal-100',
    text: 'text-teal-800',
    border: 'border-teal-200',
    icon: CheckCircle,
  },
  CHECKED_IN: {
    bg: 'bg-cyan-100',
    text: 'text-cyan-900',
    border: 'border-cyan-200',
    icon: CheckCircle,
  },
  THAWED: {
    bg: 'bg-indigo-100',
    text: 'text-indigo-900',
    border: 'border-indigo-200',
    icon: CheckCircle,
  },
  COMPLETED: {
    bg: 'bg-slate-100',
    text: 'text-slate-800',
    border: 'border-slate-200',
    icon: CheckCircle,
  },
  CANCELLED: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    border: 'border-red-200',
    icon: XCircle,
  },
  DECLINED: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    border: 'border-red-200',
    icon: XCircle,
  },
  REFUNDED: {
    bg: 'bg-purple-100',
    text: 'text-purple-900',
    border: 'border-purple-200',
    icon: XCircle,
  },
}

// Status badge component
function StatusBadge({ status, language }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING
  const Icon = config.icon
  const key = `chatBookingStatus_${status}`
  const label = getUIText(key, language)
  const text = label !== key ? label : status

  return (
    <Badge className={`${config.bg} ${config.text} border ${config.border} flex items-center gap-1`}>
      <Icon className="h-3 w-3" />
      {text}
    </Badge>
  )
}

// Individual booking card
function BookingCard({ booking, onReviewClick, onCancelClick, language }) {
  const router = useRouter()
  
  const checkInDate = booking.check_in ? parseISO(booking.check_in) : null
  const checkOutDate = booking.check_out ? parseISO(booking.check_out) : null
  const nights = checkInDate && checkOutDate 
    ? Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24))
    : 0
  
  // Handle both 'listing' and 'listings' (Supabase join returns 'listings')
  const listing = booking.listing || booking.listings || {}
  const listingImage = listing.images?.[0] || listing.cover_image || '/placeholder.svg'
  
  const canLeaveReview = () => {
    if (booking.status === 'COMPLETED') return true
    const co = booking.check_out ? String(booking.check_out).slice(0, 10) : null
    const today = listingDateToday()
    return (
      !!co &&
      co < today &&
      ['PAID_ESCROW', 'CHECKED_IN', 'THAWED'].includes(booking.status)
    )
  }

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
    
    if (
      booking.status === 'PAID' ||
      booking.status === 'PAID_ESCROW' ||
      booking.status === 'CHECKED_IN' ||
      booking.status === 'THAWED'
    ) {
      return (
        <Button 
          variant="outline"
          onClick={() => router.push(`/checkout/${booking.id}`)}
        >
          Детали
        </Button>
      )
    }
    
    if (canLeaveReview()) {
      return (
        <Button 
          className="bg-teal-600 hover:bg-teal-700"
          onClick={() => onReviewClick(booking)}
        >
          <Star className="h-4 w-4 mr-2" />
          {getUIText('renterReviewLeaveButton', language)}
        </Button>
      )
    }
    
    return null
  }
  
  const chatLabel = getUIText('bookingCard_openChat', language)
  const convId = booking.conversation_id || booking.conversationId

  return (
    <Card
      className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
      data-booking-card={booking.id}
    >
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
            
            <StatusBadge status={booking.status} language={language} />
          </div>
          
          {/* Footer */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-4 border-t border-slate-100">
            <div>
              <p className="text-sm text-slate-600 mb-1">{getUIText('checkout_total', language)}</p>
              <p className="text-2xl font-bold text-slate-900">
                {formatPrice(getGuestPayableRoundedThb(booking), 'THB')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              {convId && (
                <Button type="button" variant="outline" className="border-teal-200 text-teal-800 hover:bg-teal-50" asChild>
                  <Link href={`/messages/${encodeURIComponent(convId)}`} onClick={(e) => e.stopPropagation()}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    {chatLabel}
                  </Link>
                </Button>
              )}
              {canRenterCancelBooking(booking.status) && (
                <Button
                  type="button"
                  variant="outline"
                  className="border-red-200 text-red-700 hover:bg-red-50"
                  onClick={(e) => {
                    e.stopPropagation()
                    onCancelClick?.(booking.id)
                  }}
                >
                  {getUIText('renterCancel_button', language)}
                </Button>
              )}
              {getActionButton()}
            </div>
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
  const searchParams = useSearchParams()
  const deepTabDone = useRef(false)
  const deepScrollDone = useRef(false)
  const [userId, setUserId] = useState(null)
  const [activeTab, setActiveTab] = useState('all')
  const queryClient = useQueryClient()
  
  // Review modal state
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [cancelBookingId, setCancelBookingId] = useState(null)
  
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
        return (
          checkIn &&
          isFuture(checkIn) &&
          ['CONFIRMED', 'AWAITING_PAYMENT', 'PAID', 'PAID_ESCROW', 'CHECKED_IN', 'THAWED'].includes(b.status)
        )
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

  useEffect(() => {
    const tid = searchParams.get('booking')
    if (!tid || deepTabDone.current || !bookings?.length) return
    const b = bookings.find((x) => String(x.id) === String(tid))
    if (!b) {
      deepTabDone.current = true
      deepScrollDone.current = true
      return
    }
    deepTabDone.current = true
    setActiveTab(tabForBookingDeepLink(b))
  }, [bookings, searchParams])

  useEffect(() => {
    const tid = searchParams.get('booking')
    if (!tid || deepScrollDone.current) return
    const shown = filteredBookings.some((x) => String(x.id) === String(tid))
    if (!shown) return
    deepScrollDone.current = true
    const tmr = window.setTimeout(() => {
      const safe = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(tid) : tid.replace(/"/g, '')
      const el = document.querySelector(`[data-booking-card="${safe}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.classList.add('ring-2', 'ring-teal-500', 'ring-offset-2', 'rounded-xl')
      window.setTimeout(() => {
        el?.classList.remove('ring-2', 'ring-teal-500', 'ring-offset-2', 'rounded-xl')
      }, 4000)
    }, 200)
    return () => window.clearTimeout(tmr)
  }, [filteredBookings, searchParams])

  // Count badges
  const counts = useMemo(() => {
    return {
      all: bookings.length,
      upcoming: bookings.filter(b => {
        const checkIn = b.check_in ? parseISO(b.check_in) : null
        return (
          checkIn &&
          isFuture(checkIn) &&
          ['CONFIRMED', 'AWAITING_PAYMENT', 'PAID', 'PAID_ESCROW', 'CHECKED_IN', 'THAWED'].includes(b.status)
        )
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
    mutationFn: async ({ ratings, comment, photos = [] }) => {
      const res = await fetch('/api/v2/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          listingId: selectedBooking.listing_id,
          bookingId: selectedBooking.id,
          ratings,
          comment,
          ...(photos?.length ? { photos } : {}),
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
                  onCancelClick={(id) => setCancelBookingId(id)}
                  language={language}
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
        userId={userId}
        onSubmit={handleReviewSubmit}
        isSubmitting={submitReviewMutation.isPending}
      />

      <CancelBookingDialog
        open={!!cancelBookingId}
        onOpenChange={(open) => {
          if (!open) setCancelBookingId(null)
        }}
        bookingId={cancelBookingId}
        language={language}
        onCancelled={() => {
          queryClient.invalidateQueries({ queryKey: ['renter-bookings', userId] })
          toast.success(language === 'ru' ? 'Бронирование отменено' : 'Booking cancelled')
        }}
      />
    </div>
  )
}
