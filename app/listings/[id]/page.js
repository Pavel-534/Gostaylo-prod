'use client'

/**
 * Gostaylo Premium Listing Detail Page
 * Refactored - Phase 7.6
 * 
 * @refactored Clean component-based architecture
 */

import React, { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, X, ChevronLeft, ChevronRight, Loader2, Heart } from 'lucide-react'
import dynamic from 'next/dynamic'
import { BentoGallery } from '@/components/listing/BentoGallery'
import { DesktopBookingWidget, MobileBookingBar } from '@/components/listing/BookingWidget'
import { AmenitiesGrid } from '@/components/listing/AmenitiesGrid'
import { ListingInfo } from '@/components/listing/ListingInfo'
import { ReviewsSection } from '@/components/listing/ReviewsSection'
import { LeafletCSS } from '@/components/listing/ListingMap'
import { formatPrice } from '@/lib/currency'
import { toast } from 'sonner'
import { detectLanguage } from '@/lib/translations'
import { PricingService } from '@/lib/services/pricing.service'
import { useAuth } from '@/contexts/auth-context'
import { GostayloCalendar } from '@/components/gostaylo-calendar'
import { useRecentlyViewed } from '@/lib/hooks/use-recently-viewed'
import { format, differenceInDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Card, CardContent } from '@/components/ui/card'

const ListingMap = dynamic(
  () => import('@/components/listing/ListingMap').then((mod) => mod.ListingMap),
  { 
    ssr: false,
    loading: () => (
      <div className="h-[400px] bg-slate-100 rounded-xl flex items-center justify-center">
        <div className="animate-pulse text-slate-400">Loading map...</div>
      </div>
    )
  }
)

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
    if (!listing || !dateRange?.from || !dateRange?.to) {
      setPriceCalc(null)
      return
    }
    
    const checkIn = format(dateRange.from, 'yyyy-MM-dd')
    const checkOut = format(dateRange.to, 'yyyy-MM-dd')
    const nights = differenceInDays(dateRange.to, dateRange.from)
    
    if (nights > 0) {
      const calc = PricingService.calculatePrice({
        basePriceThb: listing.basePriceThb,
        seasonalPricing: listing.seasonalPricing || [],
        checkIn,
        checkOut,
        currency,
        exchangeRates
      })
      
      const serviceFeeRate = (listing.commissionRate || 15) / 100
      const serviceFee = Math.round(calc.totalPrice * serviceFeeRate)
      
      setPriceCalc({
        ...calc,
        nights,
        commissionRate: listing.commissionRate || 15,
        serviceFee,
        finalTotal: calc.totalPrice + serviceFee
      })
    } else {
      setPriceCalc(null)
    }
  }, [listing, dateRange, currency, exchangeRates])
  
  async function loadListing() {
    try {
      const res = await fetch(`/api/v2/listings/${params.id}`)
      const data = await res.json()
      
      if (data.success && data.data) {
        const l = data.data
        setListing({
          id: l.id,
          ownerId: l.ownerId,
          owner: l.owner,
          categoryId: l.categoryId,
          category: l.category,
          status: l.status,
          title: l.title,
          description: l.description,
          district: l.district,
          address: l.address,
          latitude: l.latitude,
          longitude: l.longitude,
          basePriceThb: parseFloat(l.basePriceThb),
          commissionRate: parseFloat(l.commissionRate) || 15,
          images: l.images || [],
          coverImage: l.coverImage,
          metadata: l.metadata || {},
          available: l.available,
          isFeatured: l.isFeatured,
          views: l.views || 0,
          rating: parseFloat(l.rating) || 0,
          reviewsCount: l.reviewsCount || 0,
          seasonalPricing: l.seasonalPricing || [],
          minStay: l.minBookingDays || 1
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
          renterId: user.id,
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
  
  const maxGuests = listing?.metadata?.max_guests || listing?.metadata?.guests || 4
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
    <>
      <LeafletCSS />
      <div className="min-h-screen bg-white">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <Button variant="ghost" onClick={() => router.back()} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{language === 'ru' ? 'Назад' : 'Back'}</span>
            </Button>
            <Button variant="ghost" size="icon">
              <Heart className="h-5 w-5" />
            </Button>
          </div>
        </header>
        
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 lg:pb-8">
          {/* Gallery */}
          <BentoGallery 
            images={allImages}
            title={listing.title}
            language={language}
            onImageClick={() => setGalleryOpen(true)}
          />
          
          {/* 2-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* LEFT: Main Content */}
            <div className="lg:col-span-2 space-y-8">
              <ListingInfo listing={listing} language={language} />
              
              {/* Mobile: Inline Calendar */}
              <div className="lg:hidden">
                <h2 className="text-2xl font-medium tracking-tight mb-4">
                  {language === 'ru' ? 'Выберите даты' : 'Select Your Dates'}
                </h2>
                <Card className="border-slate-200 bg-slate-50">
                  <CardContent className="p-4 space-y-4">
                    <div>
                      <Label className="text-sm font-medium mb-2 block">
                        {language === 'ru' ? 'Даты проживания' : 'Travel Dates'}
                      </Label>
                      <GostayloCalendar
                        key={calendarKey}
                        listingId={listing.id}
                        value={dateRange}
                        onChange={setDateRange}
                        minStay={listing.minStay}
                        language={language}
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-2 block">
                        {language === 'ru' ? 'Количество гостей' : 'Number of Guests'}
                      </Label>
                      <Input
                        type="number"
                        min="1"
                        max={maxGuests}
                        value={guests}
                        onChange={(e) => setGuests(parseInt(e.target.value) || 1)}
                        className="h-12"
                      />
                    </div>
                    {priceCalc && (
                      <div className="bg-white p-4 rounded-lg space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>
                            {formatPrice(priceCalc.avgPricePerNight, currency, exchangeRates)} × {priceCalc.nights} {language === 'ru' ? 'ночей' : 'nights'}
                          </span>
                          <span className="font-medium">{formatPrice(priceCalc.finalTotal, currency, exchangeRates)}</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
              
              <Separator className="lg:hidden" />
              
              <AmenitiesGrid amenities={amenities} language={language} />
              <Separator />
              
              {/* Location Map */}
              <div>
                <h2 className="text-2xl font-medium tracking-tight mb-4">
                  {language === 'ru' ? 'Где вы будете' : "Where you'll be"}
                </h2>
                <ListingMap
                  latitude={listing.latitude}
                  longitude={listing.longitude}
                  title={listing.title}
                  district={listing.district}
                  language={language}
                  categoryId={listing.category_id}
                />
                {listing.district && (
                  <p className="text-sm text-slate-600 mt-4">
                    {listing.district}, {listing.city || 'Phuket'}, {language === 'ru' ? 'Таиланд' : 'Thailand'}
                  </p>
                )}
              </div>
              
              <Separator />
              
              <ReviewsSection listing={listing} reviews={reviews} language={language} />
            </div>
            
            {/* RIGHT: STICKY BOOKING WIDGET */}
            <div className="lg:col-span-1">
              <DesktopBookingWidget
                listing={listing}
                dateRange={dateRange}
                setDateRange={setDateRange}
                guests={guests}
                setGuests={setGuests}
                priceCalc={priceCalc}
                currency={currency}
                exchangeRates={exchangeRates}
                language={language}
                calendarKey={calendarKey}
                onBookingClick={() => setBookingModalOpen(true)}
              />
              
              <MobileBookingBar
                listing={listing}
                priceCalc={priceCalc}
                dateRange={dateRange}
                currency={currency}
                exchangeRates={exchangeRates}
                language={language}
                onBookingClick={() => setBookingModalOpen(true)}
              />
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
                <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} required />
              </div>
              <div>
                <Label>{language === 'ru' ? 'Email' : 'Email'}</Label>
                <Input type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} required />
              </div>
              <div>
                <Label>{language === 'ru' ? 'Телефон' : 'Phone'}</Label>
                <Input type="tel" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} required />
              </div>
              <div>
                <Label>{language === 'ru' ? 'Особые пожелания' : 'Special Requests'}</Label>
                <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
              </div>
              
              {priceCalc && (
                <div className="bg-slate-50 p-4 rounded-lg space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{language === 'ru' ? 'Даты' : 'Dates'}:</span>
                    <span>
                      {format(dateRange.from, 'd MMM', { locale: ru })} - {format(dateRange.to, 'd MMM', { locale: ru })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold">
                    <span>{language === 'ru' ? 'Итого' : 'Total'}:</span>
                    <span>{formatPrice(priceCalc.finalTotal, currency, exchangeRates)}</span>
                  </div>
                </div>
              )}
              
              <Button type="submit" disabled={submitting} className="w-full bg-teal-600 hover:bg-teal-700">
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
    </>
  )
}

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
