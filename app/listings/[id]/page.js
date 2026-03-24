'use client'

/**
 * Gostaylo Premium Listing Detail Page
 * Refactored - Phase 7.6 Final
 * 
 * Clean modular architecture with extracted components
 */

import React, { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Loader2, Heart } from 'lucide-react'
import dynamic from 'next/dynamic'
import { BentoGallery } from '@/components/listing/BentoGallery'
import { DesktopBookingWidget, MobileBookingBar } from '@/components/listing/BookingWidget'
import { AmenitiesGrid } from '@/components/listing/AmenitiesGrid'
import { ListingInfo } from '@/components/listing/ListingInfo'
import { ReviewsSection } from '@/components/listing/ReviewsSection'
import { GalleryModal } from '@/components/listing/GalleryModal'
import { BookingModal } from '@/components/listing/BookingModal'
import { toast } from 'sonner'
import { detectLanguage, getUIText } from '@/lib/translations'
import { PricingService } from '@/lib/services/pricing.service'
import { useAuth } from '@/contexts/auth-context'
import { GostayloCalendar } from '@/components/gostaylo-calendar'
import { useRecentlyViewed } from '@/lib/hooks/use-recently-viewed'
import { format, differenceInDays } from 'date-fns'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { formatPrice } from '@/lib/currency'
import { cn } from '@/lib/utils'

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
  const { addToRecent } = useRecentlyViewed()
  
  // State
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
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [dateRange, setDateRange] = useState({ from: null, to: null })
  const [guests, setGuests] = useState(2)
  const [message, setMessage] = useState('')
  const [priceCalc, setPriceCalc] = useState(null)
  const [calendarKey, setCalendarKey] = useState(0)
  const [isFavorite, setIsFavorite] = useState(false)
  const [favoriteLoading, setFavoriteLoading] = useState(false)
  const [contactPartnerLoading, setContactPartnerLoading] = useState(false)
  
  // Initialize from URL
  useEffect(() => {
    const checkInParam = searchParams.get('checkIn')
    const checkOutParam = searchParams.get('checkOut')
    const guestsParam = searchParams.get('guests')
    
    if (checkInParam && checkOutParam) {
      try {
        const from = new Date(checkInParam + 'T00:00:00')
        const to = new Date(checkOutParam + 'T00:00:00')
        if (from >= new Date() && to > from) {
          setDateRange({ from, to })
        }
      } catch (e) {
        // Invalid dates
      }
    }
    
    if (guestsParam) setGuests(parseInt(guestsParam) || 2)
  }, [searchParams])
  
  // Load data
  useEffect(() => {
    setLanguage(detectLanguage())
    loadListing()
    loadReviews()
  }, [params.id])

  // Sync language when user switches in header
  useEffect(() => {
    const handler = (e) => e?.detail && setLanguage(e.detail)
    window.addEventListener('language-change', handler)
    return () => window.removeEventListener('language-change', handler)
  }, [])
  
  // Load favorite status when user and listing are ready
  useEffect(() => {
    if (!user?.id || !listing?.id) {
      setIsFavorite(false)
      return
    }
    fetch('/api/v2/favorites')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.favorites) {
          const inFavs = data.favorites.some(f => f.listing_id === listing.id)
          setIsFavorite(inFavs)
        }
      })
      .catch(() => {})
  }, [user?.id, listing?.id])
  
  // Track recently viewed
  useEffect(() => {
    if (listing && !loading) {
      addToRecent({
        id: listing.id,
        title: listing.title,
        district: listing.district,
        coverImage: listing.coverImage,
        basePriceThb: listing.basePriceThb,
        rating: listing.rating,
        reviewsCount: listing.reviewsCount
      })
    }
  }, [listing, loading, addToRecent])
  
  // Auto-fill user data
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
    
    const nights = differenceInDays(dateRange.to, dateRange.from)
    if (nights > 0) {
      const calc = PricingService.calculatePrice({
        basePriceThb: listing.basePriceThb,
        seasonalPricing: listing.seasonalPricing || [],
        checkIn: format(dateRange.from, 'yyyy-MM-dd'),
        checkOut: format(dateRange.to, 'yyyy-MM-dd'),
        currency,
        exchangeRates
      })
      
      const serviceFeeRate = (listing.commissionRate || 15) / 100
      const serviceFee = Math.round(calc.totalPrice * serviceFeeRate)
      
      setPriceCalc({
        ...calc,
        nights,
        subtotal: calc.totalPrice,
        commissionRate: listing.commissionRate || 15,
        serviceFee,
        finalTotal: calc.totalPrice + serviceFee
      })
    }
  }, [listing, dateRange, currency, exchangeRates])
  
  async function loadListing() {
    try {
      const res = await fetch(`/api/v2/listings/${params.id}`)
      const data = await res.json()
      
      if (data.success && data.data) {
        const l = data.data
        const seasonalRaw = l.seasonalPrices || l.seasonalPricing || []
        const seasonalPricing = Array.isArray(seasonalRaw)
          ? seasonalRaw.map((sp) => ({
              startDate: sp.startDate || sp.start_date,
              endDate: sp.endDate || sp.end_date,
              priceDaily: sp.priceDaily ?? sp.price_daily,
              label: sp.label,
              seasonType: sp.seasonType || sp.season_type,
              name: sp.label,
              priceMultiplier: sp.priceMultiplier,
            }))
          : []
        setListing({
          id: l.id,
          ownerId: l.ownerId,
          owner: l.owner,
          title: l.title,
          description: l.description,
          district: l.district,
          latitude: l.latitude,
          longitude: l.longitude,
          basePriceThb: parseFloat(l.basePriceThb),
          commissionRate: parseFloat(l.commissionRate) || 15,
          images: l.images || [],
          coverImage: l.coverImage,
          metadata: l.metadata || {},
          rating: parseFloat(l.rating) || 0,
          reviewsCount: l.reviewsCount || 0,
          seasonalPricing,
          minStay: l.minBookingDays || 1,
          city: l.city,
          category_id: l.categoryId
        })
      }
      setLoading(false)
    } catch (error) {
      console.error('Failed to load listing:', error)
      setLoading(false)
    }
  }
  
  const showContactPartner =
    !!listing?.ownerId && String(user?.id || '') !== String(listing.ownerId)

  async function handleContactPartner() {
    if (!listing?.ownerId) {
      toast.error(language === 'ru' ? 'Объявление недоступно' : 'Listing unavailable')
      return
    }
    if (!user) {
      openLoginModal()
      return
    }
    if (String(user.id) === String(listing.ownerId)) return

    setContactPartnerLoading(true)
    try {
      const res = await fetch('/api/v2/chat/conversations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: listing.id,
          partnerId: listing.ownerId,
          sendIntro: false,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        toast.error(json.error || (language === 'ru' ? 'Не удалось открыть чат' : 'Could not open chat'))
        return
      }
      const id = json.data?.id
      if (id) {
        const title = listing.title || (language === 'ru' ? 'объект' : 'this listing')
        const draft =
          language === 'ru'
            ? `Здравствуйте! Меня интересует объект «${title}». Пожалуйста, расскажите подробнее о доступности и условиях.`
            : `I'm interested in "${title}". Could you share more details about availability and conditions?`
        try {
          sessionStorage.setItem(`gostaylo_chat_prefill_${id}`, draft)
        } catch {
          /* ignore */
        }
        router.push(`/messages/${encodeURIComponent(id)}`)
      }
    } catch (e) {
      console.error(e)
      toast.error(language === 'ru' ? 'Ошибка сети' : 'Network error')
    } finally {
      setContactPartnerLoading(false)
    }
  }

  async function loadReviews() {
    try {
      const res = await fetch(`/api/v2/reviews?listing_id=${params.id}`)
      const data = await res.json()
      if (data.success) {
        // API returns { data: { reviews: [], stats: {} } }
        const raw = data.data
        setReviews(Array.isArray(raw) ? raw : (raw?.reviews ?? []))
      }
    } catch (error) {
      // Failed to load reviews
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
      const res = await fetch('/api/v2/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: listing.id,
          renterId: user.id,
          checkIn: format(dateRange.from, 'yyyy-MM-dd'),
          checkOut: format(dateRange.to, 'yyyy-MM-dd'),
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
  
  async function handleFavoriteClick() {
    if (!user) {
      openLoginModal()
      return
    }
    if (favoriteLoading) return
    setFavoriteLoading(true)
    const newState = !isFavorite
    setIsFavorite(newState)
    try {
      const res = await fetch('/api/v2/favorites', {
        method: newState ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: listing.id })
      })
      const data = await res.json()
      if (!data.success) {
        setIsFavorite(!newState)
        toast.error(language === 'ru' ? 'Ошибка обновления избранного' : 'Failed to update favorites')
      } else {
        toast.success(newState
          ? (language === 'ru' ? '❤️ Добавлено в избранное' : '❤️ Added to favorites')
          : (language === 'ru' ? 'Удалено из избранного' : 'Removed from favorites'))
      }
    } catch (err) {
      setIsFavorite(!newState)
      toast.error(language === 'ru' ? 'Ошибка сети' : 'Network error')
    } finally {
      setFavoriteLoading(false)
    }
  }
  
  const allImages = useMemo(() => {
    if (!listing) return []
    const imgs = []
    if (listing.coverImage) imgs.push(listing.coverImage)
    if (listing.images?.length) {
      listing.images.forEach(img => {
        if (img !== listing.coverImage) imgs.push(img)
      })
    }
    return imgs.length > 0 ? imgs : []
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
      <div className="min-h-screen bg-white">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <Button variant="ghost" onClick={() => router.back()} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{language === 'ru' ? 'Назад' : 'Back'}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleFavoriteClick}
              disabled={favoriteLoading}
              aria-label={isFavorite ? (language === 'ru' ? 'Удалить из избранного' : 'Remove from favorites') : (language === 'ru' ? 'Добавить в избранное' : 'Add to favorites')}
            >
              <Heart className={cn('h-5 w-5', isFavorite && 'fill-red-500 text-red-500')} />
            </Button>
          </div>
        </header>
        
        <main
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-40 lg:pb-8"
        >
          <BentoGallery 
            images={allImages}
            title={listing.title}
            language={language}
            onImageClick={() => setGalleryOpen(true)}
          />
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2 space-y-8">
              <ListingInfo listing={listing} language={language} />
              
              {/* Mobile inline calendar */}
              <div className="lg:hidden">
                <h2 className="text-2xl font-medium tracking-tight mb-4">
                  {getUIText('selectYourDates', language)}
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
                        {getUIText('numberOfGuests', language)}
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
                      <div className="bg-white p-4 rounded-lg">
                        <div className="flex justify-between text-sm">
                          <span>
                            {formatPrice(priceCalc.avgPricePerNight, currency, exchangeRates)} × {priceCalc.nights} {getUIText('nights', language)}
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
              
              <div>
                <h2 className="text-2xl font-medium tracking-tight mb-4">
                  {getUIText('whereYoullBe', language)}
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
                    {listing.district}, {listing.city || 'Phuket'}, {getUIText('thailand', language)}
                  </p>
                )}
              </div>
              
              <Separator />
              <ReviewsSection listing={listing} reviews={reviews} language={language} />
            </div>
            
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
                showAskPartner={showContactPartner}
                onAskPartner={handleContactPartner}
                askPartnerLoading={contactPartnerLoading}
              />
              
              <MobileBookingBar
                listing={listing}
                priceCalc={priceCalc}
                dateRange={dateRange}
                currency={currency}
                exchangeRates={exchangeRates}
                language={language}
                onBookingClick={() => setBookingModalOpen(true)}
                showAskPartner={showContactPartner}
                onAskPartner={handleContactPartner}
                askPartnerLoading={contactPartnerLoading}
              />
            </div>
          </div>
        </main>
        
        <GalleryModal
          open={galleryOpen}
          onOpenChange={setGalleryOpen}
          images={allImages}
          currentIndex={galleryIndex}
          onIndexChange={setGalleryIndex}
          listingTitle={listing.title}
        />
        
        <BookingModal
          open={bookingModalOpen}
          onOpenChange={setBookingModalOpen}
          guestName={guestName}
          setGuestName={setGuestName}
          guestEmail={guestEmail}
          setGuestEmail={setGuestEmail}
          guestPhone={guestPhone}
          setGuestPhone={setGuestPhone}
          message={message}
          setMessage={setMessage}
          dateRange={dateRange}
          priceCalc={priceCalc}
          currency={currency}
          exchangeRates={exchangeRates}
          language={language}
          submitting={submitting}
          onSubmit={handleBookingSubmit}
        />
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
