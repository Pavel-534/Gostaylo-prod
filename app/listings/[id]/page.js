'use client'

/**
 * Gostaylo Premium Listing Detail Page - Phase 4.5
 * Airbnb-style high-conversion design
 * 
 * Features:
 * - Bento Gallery (1 large + 4 small images)
 * - Sticky Booking Widget with real-time pricing
 * - Advanced Reviews Section (5-category ratings)
 * - Categorized Amenities Grid
 * - Host Profile Section
 * - Recently Viewed tracking
 * 
 * @version 4.5
 */

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { 
  MapPin, Star, ArrowLeft, X, ChevronLeft, ChevronRight,
  Users, Bed, Bath, Square, Calendar, Send, Loader2, User,
  Wifi, Car, Waves, Utensils, Info, Check, Heart, Shield, Clock, Award
} from 'lucide-react'
import { formatPrice } from '@/lib/currency'
import { toast } from 'sonner'
import { detectLanguage, getUIText } from '@/lib/translations'
import { PricingService } from '@/lib/services/pricing.service'
import { useAuth } from '@/contexts/auth-context'
import { GostayloCalendar } from '@/components/gostaylo-calendar'
import { useRecentlyViewed } from '@/lib/hooks/use-recently-viewed'
import { format, differenceInDays } from 'date-fns'
import { ru } from 'date-fns/locale'

const SERVICE_FEE_RATE = 0.05 // 5% service fee

// Amenity categories with icons
const AMENITY_ICONS = {
  wifi: Wifi,
  parking: Car,
  pool: Waves,
  kitchen: Utensils,
  // Add more as needed
}

// Premium Listing Detail Component
function PremiumListingContent({ params }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, openLoginModal } = useAuth()
  const [listing, setListing] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [bookingModalOpen, setBookingModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [language, setLanguage] = useState('ru')
  const [currency, setCurrency] = useState('THB')
  const [exchangeRates, setExchangeRates] = useState({ THB: 1 })
  
  // Form state
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [dateRange, setDateRange] = useState({ from: null, to: null })
  const [guests, setGuests] = useState(2)
  const [message, setMessage] = useState('')
  const [datesInitialized, setDatesInitialized] = useState(false)
  
  // Price calculation state
  const [priceCalc, setPriceCalc] = useState(null)
  const [commissionRate, setCommissionRate] = useState(15)
  
  // Calendar refresh
  const [calendarKey, setCalendarKey] = useState(0)
  
  // Recently viewed tracking
  const { addToRecent } = useRecentlyViewed()
  
  // Initialize dates from URL
  useEffect(() => {
    if (datesInitialized || typeof window === 'undefined') return
    
    const urlParams = new URLSearchParams(window.location.search)
    const checkInParam = urlParams.get('checkIn')
    const checkOutParam = urlParams.get('checkOut')
    const guestsParam = urlParams.get('guests')
    
    if (checkInParam && checkOutParam) {
      try {
        const from = new Date(checkInParam + 'T00:00:00')
        const to = new Date(checkOutParam + 'T00:00:00')
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        if (from >= today && to > from) {
          setDateRange({ from, to })
        }
      } catch (e) {
        console.error('Invalid date params:', e)
      }
    }
    
    if (guestsParam) {
      setGuests(parseInt(guestsParam) || 2)
    }
    
    setDatesInitialized(true)
  }, [datesInitialized])
  
  // Load listing data
  useEffect(() => {
    const detectedLang = detectLanguage()
    setLanguage(detectedLang)
    loadListing()
    loadReviews()
  }, [params.id])
  
  // Add to recently viewed
  useEffect(() => {
    if (listing && !loading) {
      addToRecent({
        id: listing.id,
        title: listing.title,
        district: listing.district,
        coverImage: listing.coverImage,
        cover_image: listing.coverImage,
        basePriceThb: listing.basePriceThb,
        base_price_thb: listing.basePriceThb,
        rating: listing.rating,
        reviewsCount: listing.reviewsCount,
        metadata: listing.metadata,
        images: listing.images
      })
    }
  }, [listing, loading, addToRecent])
  
  // Auto-fill form from user
  useEffect(() => {
    if (user) {
      setGuestName(user.firstName || user.name || '')
      setGuestEmail(user.email || '')
      setGuestPhone(user.phone || '')
    }
  }, [user])
  
  // Calculate pricing
  useEffect(() => {
    console.log('[PREMIUM PAGE] dateRange changed:', dateRange, 'from:', dateRange?.from, 'to:', dateRange?.to)
    
    if (!listing || !dateRange?.from || !dateRange?.to) {
      setPriceCalc(null)
      return
    }
    
    const checkIn = format(dateRange.from, 'yyyy-MM-dd')
    const checkOut = format(dateRange.to, 'yyyy-MM-dd')
    const nights = differenceInDays(dateRange.to, dateRange.from)
    
    console.log('[PREMIUM PAGE] Calculating price:', { checkIn, checkOut, nights })
    
    if (nights > 0) {
      const calc = PricingService.calculatePrice({
        basePriceThb: listing.basePriceThb,
        seasonalPricing: listing.seasonalPricing || [],
        checkIn,
        checkOut,
        currency,
        exchangeRates
      })
      
      console.log('[PREMIUM PAGE] Calc result:', calc)
      
      setPriceCalc({
        ...calc,
        nights,
        serviceFee: Math.round(calc.totalPrice * SERVICE_FEE_RATE),
        finalTotal: calc.totalPrice + Math.round(calc.totalPrice * SERVICE_FEE_RATE)
      })
    } else {
      setPriceCalc(null)
    }
  }, [listing, dateRange, currency, exchangeRates])
  
  async function loadListing() {
    try {
      const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
      const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/listings?id=eq.${params.id}&select=*,categories(id,name,slug,icon),owner:profiles!owner_id(id,first_name,last_name,email)`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          }
        }
      )
      
      const data = await res.json()
      
      if (data && data.length > 0) {
        const l = data[0]
        setListing({
          id: l.id,
          ownerId: l.owner_id,
          owner: l.owner,
          categoryId: l.category_id,
          category: l.categories,
          status: l.status,
          title: l.title,
          description: l.description,
          district: l.district,
          address: l.address,
          basePriceThb: parseFloat(l.base_price_thb),
          images: l.images || [],
          coverImage: l.cover_image,
          metadata: l.metadata || {},
          available: l.available,
          isFeatured: l.is_featured,
          views: l.views || 0,
          rating: parseFloat(l.rating) || 0,
          reviewsCount: l.reviews_count || 0,
          seasonalPricing: l.metadata?.seasonal_pricing || [],
          minStay: l.min_booking_days || 1
        })
      }
      
      setLoading(false)
    } catch (error) {
      console.error('Failed to load listing:', error)
      setLoading(false)
    }
  }
  
  async function loadReviews() {
    try {
      const res = await fetch(`/api/v2/reviews?listingId=${params.id}`)
      const data = await res.json()
      if (data.success) {
        setReviews(data.data || [])
      }
    } catch (error) {
      console.error('Failed to load reviews:', error)
    }
  }
  
  async function handleBookingSubmit(e) {
    e.preventDefault()
    
    if (!user) {
      openLoginModal()
      return
    }
    
    if (!dateRange.from || !dateRange.to) {
      toast.error(language === 'ru' ? 'Выберите даты' : 'Select dates')
      return
    }
    
    setSubmitting(true)
    
    try {
      const checkIn = format(dateRange.from, 'yyyy-MM-dd')
      const checkOut = format(dateRange.to, 'yyyy-MM-dd')
      
      const res = await fetch('/api/v2/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: listing.id,
          checkIn,
          checkOut,
          guestName,
          guestEmail,
          guestPhone,
          specialRequests: message || null,
          currency: 'THB'
        })
      })
      
      const data = await res.json()
      
      if (data.success) {
        toast.success(language === 'ru' ? 'Бронирование создано!' : 'Booking created!')
        setBookingModalOpen(false)
        // Redirect to bookings page
        router.push('/renter/bookings')
      } else {
        toast.error(data.error || 'Booking failed')
      }
    } catch (error) {
      toast.error('Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }
  
  // Extract metadata
  const bedrooms = listing?.metadata?.bedrooms || 0
  const bathrooms = listing?.metadata?.bathrooms || 0
  const maxGuests = listing?.metadata?.max_guests || listing?.metadata?.guests || 4
  const area = listing?.metadata?.area || 0
  const amenities = listing?.metadata?.amenities || []
  
  // All images for gallery
  const allImages = useMemo(() => {
    if (!listing) return []
    const imgs = []
    if (listing.coverImage) imgs.push(listing.coverImage)
    if (listing.images?.length) {
      listing.images.forEach(img => {
        if (img !== listing.coverImage) imgs.push(img)
      })
    }
    return imgs
  }, [listing])
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    )
  }
  
  if (!listing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Listing not found</h2>
          <Button onClick={() => router.push('/listings')} variant="outline">
            Back to listings
          </Button>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{language === 'ru' ? 'Назад' : 'Back'}</span>
          </Button>
          
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon">
              <Heart className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* BENTO GALLERY */}
        <div 
          className="grid grid-cols-1 md:grid-cols-4 gap-2 h-[50vh] min-h-[400px] max-h-[600px] rounded-2xl overflow-hidden mb-12 cursor-pointer"
          onClick={() => setGalleryOpen(true)}
        >
          {/* Main large image */}
          {allImages[0] && (
            <div className="relative md:col-span-2 md:row-span-2 bg-slate-100">
              <Image
                src={allImages[0]}
                alt={listing.title}
                fill
                className="object-cover hover:scale-105 transition-transform duration-300"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
              />
            </div>
          )}
          
          {/* 4 smaller images */}
          {allImages.slice(1, 5).map((img, idx) => (
            <div key={idx} className="relative hidden md:block bg-slate-100">
              <Image
                src={img}
                alt={`${listing.title} ${idx + 2}`}
                fill
                className="object-cover hover:scale-105 transition-transform duration-300"
                sizes="25vw"
              />
              {idx === 3 && allImages.length > 5 && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Button variant="secondary" size="sm">
                    +{allImages.length - 5} {language === 'ru' ? 'фото' : 'more'}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* 2-Column Layout: Content + Sticky Widget */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* LEFT: Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Title & Location */}
            <div>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900 mb-2">
                    {listing.title}
                  </h1>
                  <div className="flex items-center gap-4 text-slate-600">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      <span>{listing.district}</span>
                    </div>
                    {listing.rating > 0 && (
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        <span className="font-medium">{listing.rating.toFixed(1)}</span>
                        <span className="text-slate-400">({listing.reviewsCount} {language === 'ru' ? 'отзывов' : 'reviews'})</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Specs */}
              <div className="flex items-center gap-6 text-slate-700 py-4 border-y border-slate-100">
                {bedrooms > 0 && (
                  <div className="flex items-center gap-2">
                    <Bed className="h-5 w-5 text-slate-400" />
                    <span>{bedrooms} {language === 'ru' ? 'спален' : 'bedrooms'}</span>
                  </div>
                )}
                {bathrooms > 0 && (
                  <div className="flex items-center gap-2">
                    <Bath className="h-5 w-5 text-slate-400" />
                    <span>{bathrooms} {language === 'ru' ? 'ванных' : 'bathrooms'}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-slate-400" />
                  <span>{maxGuests} {language === 'ru' ? 'гостей' : 'guests'}</span>
                </div>
                {area > 0 && (
                  <div className="flex items-center gap-2">
                    <Square className="h-5 w-5 text-slate-400" />
                    <span>{area} m²</span>
                  </div>
                )}
              </div>
            </div>
            
            <Separator />
            
            {/* Description */}
            <div>
              <h2 className="text-2xl font-medium tracking-tight mb-4">{language === 'ru' ? 'Описание' : 'Description'}</h2>
              <p className="text-base leading-relaxed text-slate-600 whitespace-pre-wrap">
                {listing.description}
              </p>
            </div>
            
            <Separator />
            
            {/* Amenities */}
            {amenities.length > 0 && (
              <div>
                <h2 className="text-2xl font-medium tracking-tight mb-4">
                  {language === 'ru' ? 'Удобства' : 'Amenities'}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {amenities.map((amenity, idx) => {
                    const Icon = AMENITY_ICONS[amenity.toLowerCase()] || Check
                    return (
                      <div key={idx} className="flex items-center gap-3 text-slate-700 py-2 border-b border-slate-50 last:border-0">
                        <Icon className="h-5 w-5 text-teal-600" />
                        <span className="capitalize">{amenity}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            
            <Separator />
            
            {/* Reviews Section */}
            <div>
              <h2 className="text-2xl font-medium tracking-tight mb-6">
                {language === 'ru' ? 'Отзывы' : 'Reviews'}
              </h2>
              
              {listing.reviewsCount > 0 ? (
                <div className="space-y-6">
                  {/* Overall Rating */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
                      <span className="text-3xl font-semibold">{listing.rating.toFixed(1)}</span>
                    </div>
                    <span className="text-slate-500">· {listing.reviewsCount} {language === 'ru' ? 'отзывов' : 'reviews'}</span>
                  </div>
                  
                  {/* Individual Reviews */}
                  {reviews.length > 0 && (
                    <div className="space-y-4 mt-6">
                      {reviews.slice(0, 3).map((review) => (
                        <Card key={review.id} className="border-slate-200">
                          <CardContent className="p-6">
                            <div className="flex items-start gap-4">
                              <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center">
                                <User className="h-6 w-6 text-teal-600" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="font-medium">{review.reviewer_name}</h4>
                                  <div className="flex items-center gap-1">
                                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                                    <span className="text-sm">{review.rating}</span>
                                  </div>
                                </div>
                                <p className="text-slate-600 text-sm leading-relaxed">{review.comment}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-slate-500">{language === 'ru' ? 'Пока нет отзывов' : 'No reviews yet'}</p>
              )}
            </div>
            
            <Separator />
            
            {/* Host Section */}
            {listing.owner && (
              <div>
                <h2 className="text-2xl font-medium tracking-tight mb-4">
                  {language === 'ru' ? 'Хозяин' : 'Meet your Host'}
                </h2>
                <Card className="border-slate-200">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center">
                        <User className="h-8 w-8 text-teal-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-lg">
                          {listing.owner.first_name} {listing.owner.last_name}
                        </h3>
                        <p className="text-sm text-slate-500">{language === 'ru' ? 'Владелец' : 'Property Owner'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
          
          {/* RIGHT: STICKY BOOKING WIDGET */}
          <div className="lg:col-span-1">
            <Card className="border-slate-200 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] sticky top-24 z-10">
              <CardContent className="p-6 space-y-6">
                {/* Price Header */}
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-semibold text-slate-900">
                      {formatPrice(listing.basePriceThb, currency, exchangeRates)}
                    </span>
                    <span className="text-slate-500">/ {language === 'ru' ? 'ночь' : 'night'}</span>
                  </div>
                  {listing.minStay > 1 && (
                    <p className="text-sm text-slate-500 mt-1">
                      {language === 'ru' ? 'Мин. ' : 'Min. '}{listing.minStay} {language === 'ru' ? 'ночей' : 'nights'}
                    </p>
                  )}
                </div>
                
                <Separator />
                
                {/* Calendar */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">{language === 'ru' ? 'Даты' : 'Dates'}</Label>
                  <GostayloCalendar
                    key={calendarKey}
                    listingId={listing.id}
                    value={dateRange}
                    onChange={setDateRange}
                    minStay={listing.minStay}
                    language={language}
                  />
                </div>
                
                {/* Guests */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">{language === 'ru' ? 'Гостей' : 'Guests'}</Label>
                  <Input
                    type="number"
                    min="1"
                    max={maxGuests}
                    value={guests}
                    onChange={(e) => setGuests(parseInt(e.target.value) || 1)}
                    className="h-12"
                  />
                </div>
                
                {/* Price Breakdown */}
                {priceCalc && (
                  <div className="space-y-2 py-4 border-y border-slate-100">
                    <div className="flex justify-between text-sm">
                      <span>{formatPrice(priceCalc.avgPricePerNight, currency, exchangeRates)} × {priceCalc.nights} {language === 'ru' ? 'ночей' : 'nights'}</span>
                      <span>{formatPrice(priceCalc.baseSubtotal, currency, exchangeRates)}</span>
                    </div>
                    {priceCalc.discountAmount > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>{language === 'ru' ? 'Скидка' : 'Discount'}</span>
                        <span>-{formatPrice(priceCalc.discountAmount, currency, exchangeRates)}</span>
                      </div>
                    )}
                    {priceCalc.surchargeAmount > 0 && (
                      <div className="flex justify-between text-sm text-red-600">
                        <span>{language === 'ru' ? 'Наценка' : 'Surcharge'}</span>
                        <span>+{formatPrice(priceCalc.surchargeAmount, currency, exchangeRates)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span>{language === 'ru' ? 'Сервисный сбор' : 'Service fee'} (5%)</span>
                      <span>{formatPrice(priceCalc.serviceFee, currency, exchangeRates)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold text-lg">
                      <span>{language === 'ru' ? 'Итого' : 'Total'}</span>
                      <span>{formatPrice(priceCalc.finalTotal, currency, exchangeRates)}</span>
                    </div>
                  </div>
                )}
                
                {/* Book Button */}
                <Button
                  onClick={() => setBookingModalOpen(true)}
                  disabled={!dateRange.from || !dateRange.to}
                  className="w-full h-12 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-95"
                  data-testid="book-now-button"
                >
                  {language === 'ru' ? 'Забронировать' : 'Book Now'}
                </Button>
                
                <p className="text-xs text-center text-slate-500">
                  {language === 'ru' ? 'Оплата не требуется' : 'You won\'t be charged yet'}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      
      {/* GALLERY MODAL */}
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="max-w-6xl h-[90vh] p-0">
          <div className="relative h-full flex items-center justify-center bg-black">
            <DialogClose className="absolute top-4 right-4 z-50">
              <Button variant="secondary" size="icon" className="rounded-full">
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
            
            <div className="relative w-full h-full flex items-center justify-center">
              <Image
                src={allImages[galleryIndex]}
                alt={`${listing.title} ${galleryIndex + 1}`}
                fill
                className="object-contain"
                sizes="100vw"
              />
            </div>
            
            {allImages.length > 1 && (
              <>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full"
                  onClick={() => setGalleryIndex((galleryIndex - 1 + allImages.length) % allImages.length)}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full"
                  onClick={() => setGalleryIndex((galleryIndex + 1) % allImages.length)}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </>
            )}
            
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-3 py-1 rounded-full">
              {galleryIndex + 1} / {allImages.length}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* BOOKING MODAL */}
      <Dialog open={bookingModalOpen} onOpenChange={setBookingModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{language === 'ru' ? 'Подтвердите бронирование' : 'Confirm Booking'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBookingSubmit} className="space-y-4">
            <div>
              <Label>{language === 'ru' ? 'Имя' : 'Name'}</Label>
              <Input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>{language === 'ru' ? 'Email' : 'Email'}</Label>
              <Input
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>{language === 'ru' ? 'Телефон' : 'Phone'}</Label>
              <Input
                type="tel"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>{language === 'ru' ? 'Особые пожелания' : 'Special Requests'}</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
              />
            </div>
            
            {priceCalc && (
              <div className="bg-slate-50 p-4 rounded-lg space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{language === 'ru' ? 'Даты' : 'Dates'}:</span>
                  <span>{format(dateRange.from, 'd MMM', { locale: ru })} - {format(dateRange.to, 'd MMM', { locale: ru })}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold">
                  <span>{language === 'ru' ? 'Итого' : 'Total'}:</span>
                  <span>{formatPrice(priceCalc.finalTotal, currency, exchangeRates)}</span>
                </div>
              </div>
            )}
            
            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-teal-600 hover:bg-teal-700"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {language === 'ru' ? 'Отправка...' : 'Submitting...'}
                </>
              ) : (
                language === 'ru' ? 'Подтвердить' : 'Confirm Booking'
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Export with Suspense wrapper
export default function PremiumListingPage({ params }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    }>
      <PremiumListingContent params={params} />
    </Suspense>
  )
}
