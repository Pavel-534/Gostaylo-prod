'use client'

/**
 * GoStayLo Premium Listing Detail Page
 * Refactored - Phase 7.6 Final
 * 
 * Clean modular architecture with extracted components
 */

import { useState, useEffect, useMemo, useRef, Suspense, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import nextDynamic from 'next/dynamic'
import {
  DesktopBookingWidget,
  MobileBookingBar,
  PriceBreakdownBlock,
} from './components/BookingWidget'
import { getListingDisplayImageUrls } from '@/lib/listing-display-images'
import { useListingPricing } from './hooks/useListingPricing'
import { ListingGallery } from './components/ListingGallery'
import { ListingPageNav } from './components/ListingPageNav'
import ListingHeader from './components/ListingHeader'
import ListingDescription from './components/ListingDescription'
import { ListingPageSkeleton } from './components/ListingPageSkeleton'
import {
  getListingBookingUiMode,
  getListingRentalPeriodMode,
  isWholeVesselListing,
} from '@/lib/listing-booking-ui'
import { isTransportListingCategory } from '@/lib/listing-category-slug'
import { AmenitiesGrid } from '@/components/listing/AmenitiesGrid'
import { ReviewsSection } from '@/components/listing/ReviewsSection'
import { GalleryModal } from '@/components/listing/GalleryModal'
import { BookingModal } from '@/components/listing/BookingModal'
import { toast } from 'sonner'
import { detectLanguage, getUIText } from '@/lib/translations'
import {
  parseDurationDiscountTiers,
  computeBestDurationDiscountPercent,
} from '@/lib/listing/duration-discount-tiers.js'
import { useAuth } from '@/contexts/auth-context'
import { GostayloCalendar } from '@/components/gostaylo-calendar'
import { useRecentlyViewed } from '@/lib/hooks/use-recently-viewed'
import { format, differenceInDays } from 'date-fns'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { GuestCountStepper } from '@/components/listing/GuestCountStepper'
import { fetchExchangeRates } from '@/lib/client-data'
import { INBOX_TAB_TRAVELING, setRenterInboxTabPreference } from '@/lib/chat-inbox-tabs'
import { useChatContext } from '@/lib/context/ChatContext'
import { useCommission } from '@/hooks/use-commission'
import { resolveListingGuestCapacity } from '@/lib/listing-guest-capacity'
import { getBookingApiUserMessage } from '@/lib/booking-error-message'
import { UrgencyTimer } from '@/components/UrgencyTimer'
import { ListingFlashHotStrip } from '@/components/listing/ListingFlashHotStrip'
import { shouldShowFlashUrgencyTimerAboveStrip } from '@/lib/listing/flash-hot-strip'

const CHAT_CACHE_TTL = 5 * 60 * 1000 // 5 min

function getChatCacheKey(listingId, userId) {
  return `gostaylo_chat_check_${listingId}_${userId}`
}

function readChatCache(listingId, userId) {
  try {
    const raw = localStorage.getItem(getChatCacheKey(listingId, userId))
    if (!raw) return null
    const entry = JSON.parse(raw)
    if (Date.now() - (entry.ts || 0) > CHAT_CACHE_TTL) return null
    return entry
  } catch {
    return null
  }
}

function writeChatCache(listingId, userId, data) {
  try {
    localStorage.setItem(
      getChatCacheKey(listingId, userId),
      JSON.stringify({ ...data, ts: Date.now() }),
    )
  } catch {}
}

function ListingMapLoadFallback() {
  const [lang, setLang] = useState('ru')
  useEffect(() => {
    setLang(detectLanguage())
    const h = (e) => e?.detail && setLang(e.detail)
    window.addEventListener('language-change', h)
    return () => window.removeEventListener('language-change', h)
  }, [])
  return (
    <div className="h-[400px] bg-slate-100 rounded-xl flex items-center justify-center">
      <div className="animate-pulse text-slate-400">{getUIText('mapPicker_loading', lang)}</div>
    </div>
  )
}

const ListingMap = nextDynamic(
  () => import('@/components/listing/ListingMap').then((mod) => mod.ListingMap),
  {
    ssr: false,
    loading: () => <ListingMapLoadFallback />,
  }
)

function PremiumListingContent({ params }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const urlBookingSyncEnabledRef = useRef(false)
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
  const [vehicleStartTime, setVehicleStartTime] = useState('07:00')
  const [vehicleEndTime, setVehicleEndTime] = useState('07:00')
  const [guests, setGuests] = useState(2)
  const [debouncedGuestsAvail, setDebouncedGuestsAvail] = useState(2)
  const [message, setMessage] = useState('')
  const [calendarKey, _setCalendarKey] = useState(0)
  const [isFavorite, setIsFavorite] = useState(false)
  const [favoriteLoading, setFavoriteLoading] = useState(false)
  const [contactPartnerLoading, setContactPartnerLoading] = useState(false)
  const [existingConvId, setExistingConvId] = useState(null)
  const [lastMessagePreview, setLastMessagePreview] = useState(null)
  const [hasUnreadFromHost, setHasUnreadFromHost] = useState(false)
  const [availabilitySnapshot, setAvailabilitySnapshot] = useState(null)
  const [availabilityFetchLoading, setAvailabilityFetchLoading] = useState(false)
  const [bookingModalIntent, setBookingModalIntent] = useState('book')

  const { getConversationForListing, loaded: chatLoaded } = useChatContext()

  const listingPartnerId = useMemo(
    () => listing?.ownerId ?? listing?.owner?.id ?? null,
    [listing?.ownerId, listing?.owner?.id],
  )
  const isVehicleListing = isTransportListingCategory(
    listing?.categorySlug || listing?.category?.slug,
  )

  const commissionHook = useCommission(listingPartnerId)

  const availabilitySyncPricing = useMemo(() => {
    if (!availabilitySnapshot?.success || availabilitySnapshot?.pricing == null) return null
    const p = availabilitySnapshot.pricing
    return {
      taxRatePercent: Number(p.taxRatePercent) || 0,
      taxAmountThb: Math.round(Number(p.taxAmountThb) || 0),
    }
  }, [availabilitySnapshot])

  const priceCalc = useListingPricing({
    listing,
    dateRange,
    guests,
    commissionLoading: commissionHook.loading,
    effectiveRate: commissionHook.effectiveRate,
    guestServiceFeePercent: commissionHook.guestServiceFeePercent,
    taxRatePercent: commissionHook.loading ? 0 : Number(commissionHook.taxRatePercent) || 0,
    syncPricing: availabilitySyncPricing,
  })

  const AVAILABILITY_GUESTS_DEBOUNCE_MS = 420

  useEffect(() => {
    const t = setTimeout(() => setDebouncedGuestsAvail(guests), AVAILABILITY_GUESTS_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [guests])

  const guestsAvailabilityPendingSync = debouncedGuestsAvail !== guests
  const availabilityLoading = availabilityFetchLoading || guestsAvailabilityPendingSync

  const buildVehicleInstantIso = useCallback((dateObj, hhmm) => {
    if (!dateObj) return null
    const d = format(dateObj, 'yyyy-MM-dd')
    const t = /^\d{2}:\d{2}$/.test(String(hhmm || '')) ? String(hhmm) : '07:00'
    return `${d}T${t}:00+07:00`
  }, [])

  const parseCalendarDay = useCallback((raw) => {
    const s = String(raw || '').trim()
    if (!s) return null
    const ymd = s.slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null
    const d = new Date(`${ymd}T00:00:00`)
    return Number.isFinite(d.getTime()) ? d : null
  }, [])

  // Initialize from URL
  useEffect(() => {
    const checkInParam = searchParams.get('checkIn')
    const checkOutParam = searchParams.get('checkOut')
    const checkInTimeParam = searchParams.get('checkInTime')
    const checkOutTimeParam = searchParams.get('checkOutTime')
    const guestsParam = searchParams.get('guests')
    
    if (checkInParam && checkOutParam) {
      const from = parseCalendarDay(checkInParam)
      const to = parseCalendarDay(checkOutParam)
      if (from && to && to > from) {
        setDateRange({ from, to })
      }
    }
    
    if (guestsParam) setGuests(parseInt(guestsParam) || 2)
    if (checkInTimeParam) setVehicleStartTime(checkInTimeParam)
    if (checkOutTimeParam) setVehicleEndTime(checkOutTimeParam)
  }, [searchParams, parseCalendarDay])

  // Allow state→URL sync only after URL query is reflected in state (avoid clobbering deep links on first paint).
  useEffect(() => {
    const cin = searchParams.get('checkIn')
    const cout = searchParams.get('checkOut')
    if (!cin || !cout) {
      urlBookingSyncEnabledRef.current = true
      return
    }
    const from = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : ''
    const to = dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : ''
    if (from === cin && to === cout) {
      urlBookingSyncEnabledRef.current = true
      return
    }
    try {
      const fromD = parseCalendarDay(cin)
      const toD = parseCalendarDay(cout)
      if (!fromD || !toD || !(toD > fromD)) {
        urlBookingSyncEnabledRef.current = true
      }
    } catch {
      urlBookingSyncEnabledRef.current = true
    }
  }, [searchParams, dateRange, parseCalendarDay])

  // Keep shareable URL in sync with calendar + guest stepper (BookingWidget / mobile card).
  useEffect(() => {
    if (!listing?.id || !pathname || !urlBookingSyncEnabledRef.current) return
    const wantIn = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : ''
    const wantOut = dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : ''
    const wantG = String(Math.max(1, Number(guests) || 1))
    const wantInTime = isVehicleListing ? String(vehicleStartTime || '07:00') : ''
    const wantOutTime = isVehicleListing ? String(vehicleEndTime || '07:00') : ''
    const curIn = searchParams.get('checkIn') || ''
    const curOut = searchParams.get('checkOut') || ''
    const curG = searchParams.get('guests') || ''
    const curInTime = searchParams.get('checkInTime') || ''
    const curOutTime = searchParams.get('checkOutTime') || ''
    if (
      wantIn === curIn &&
      wantOut === curOut &&
      wantG === curG &&
      wantInTime === curInTime &&
      wantOutTime === curOutTime
    ) return

    const p = new URLSearchParams()
    if (wantIn && wantOut) {
      p.set('checkIn', wantIn)
      p.set('checkOut', wantOut)
      if (isVehicleListing) {
        p.set('checkInTime', wantInTime)
        p.set('checkOutTime', wantOutTime)
      }
    }
    p.set('guests', wantG)
    const qs = p.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [
    dateRange,
    guests,
    listing?.id,
    pathname,
    router,
    searchParams,
    isVehicleListing,
    vehicleStartTime,
    vehicleEndTime,
  ])
  
  // Load data
  useEffect(() => {
    setLanguage(detectLanguage())
    try {
      const stored = localStorage.getItem('gostaylo_currency')
      if (stored) setCurrency(stored)
    } catch {
      /* ignore */
    }
    loadListing()
    loadReviews()
    fetchExchangeRates().then(setExchangeRates).catch(() => {})
  }, [params.id])

  useEffect(() => {
    const handler = (e) => {
      if (e?.detail) setCurrency(e.detail)
    }
    window.addEventListener('currency-change', handler)
    return () => window.removeEventListener('currency-change', handler)
  }, [])

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

  // Smart pre-check: does the user already have a conversation for this listing?
  // Priority: 1) ChatContext (free), 2) localStorage cache (5 min TTL), 3) API fallback
  useEffect(() => {
    if (!user?.id || !listing?.id || String(user.id) === String(listingPartnerId)) {
      setExistingConvId(null)
      setLastMessagePreview(null)
      setHasUnreadFromHost(false)
      return
    }

    function applyConvData(conv) {
      if (!conv) {
        setExistingConvId(null)
        setLastMessagePreview(null)
        setHasUnreadFromHost(false)
        return
      }
      const preview = conv.lastMessage?.content || conv.lastMessage?.message || null
      const unread = Number(conv.unreadCount || 0) > 0 &&
        String(conv.partnerId || conv.partner_id || '') === String(listingPartnerId || '')
      setExistingConvId(conv.id)
      setLastMessagePreview(preview ? String(preview).slice(0, 80) : null)
      setHasUnreadFromHost(unread)
      writeChatCache(listing.id, user.id, {
        id: conv.id,
        preview: preview ? String(preview).slice(0, 80) : null,
        hasUnread: unread,
      })
    }

    // 1. Try ChatContext (instant, no network)
    if (chatLoaded) {
      const conv = getConversationForListing(listing.id)
      if (conv) { applyConvData(conv); return }
      // ChatContext loaded but no conversation found → cache negative result
      writeChatCache(listing.id, user.id, { id: null })
      setExistingConvId(null)
      setLastMessagePreview(null)
      setHasUnreadFromHost(false)
      return
    }

    // 2. Try localStorage cache while ChatContext is still loading
    const cached = readChatCache(listing.id, user.id)
    if (cached) {
      setExistingConvId(cached.id || null)
      setLastMessagePreview(cached.preview || null)
      setHasUnreadFromHost(cached.hasUnread || false)
      return
    }

    // 3. API fallback (only fires when ChatContext not ready and no cache)
    fetch(
      `/api/v2/chat/conversations?listing_id=${encodeURIComponent(listing.id)}&limit=1`,
      { credentials: 'include' },
    )
      .then((r) => r.json())
      .then((data) => {
        const conv = data?.data?.[0] || null
        applyConvData(conv)
      })
      .catch(() => {})
  }, [user?.id, listing?.id, listingPartnerId, chatLoaded, getConversationForListing])

  useEffect(() => {
    if (!listing?.id || !dateRange?.from || !dateRange?.to) {
      setAvailabilitySnapshot(null)
      setAvailabilityFetchLoading(false)
      return
    }
    if (guestsAvailabilityPendingSync) {
      return
    }
    const start = format(dateRange.from, 'yyyy-MM-dd')
    const end = format(dateRange.to, 'yyyy-MM-dd')
    const startDateTime = isVehicleListing ? buildVehicleInstantIso(dateRange.from, vehicleStartTime) : null
    const endDateTime = isVehicleListing ? buildVehicleInstantIso(dateRange.to, vehicleEndTime) : null
    const ac = new AbortController()
    setAvailabilityFetchLoading(true)
    const qs = new URLSearchParams({
      startDate: start,
      endDate: end,
      guests: String(debouncedGuestsAvail),
    })
    if (startDateTime && endDateTime) {
      qs.set('startDateTime', startDateTime)
      qs.set('endDateTime', endDateTime)
    }
    fetch(
      `/api/v2/listings/${encodeURIComponent(listing.id)}/availability?${qs.toString()}`,
      { signal: ac.signal, credentials: 'omit' }
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setAvailabilitySnapshot(data)
        else setAvailabilitySnapshot(null)
      })
      .catch(() => {
        if (!ac.signal.aborted) setAvailabilitySnapshot(null)
      })
      .finally(() => {
        if (!ac.signal.aborted) setAvailabilityFetchLoading(false)
      })
    return () => ac.abort()
  }, [
    listing?.id,
    dateRange?.from,
    dateRange?.to,
    isVehicleListing,
    vehicleStartTime,
    vehicleEndTime,
    buildVehicleInstantIso,
    debouncedGuestsAvail,
    guestsAvailabilityPendingSync,
  ])
  
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
        const seasonalPricesRaw = l.seasonalPrices || []
        setListing({
          id: l.id,
          ownerId: l.ownerId ?? l.owner?.id ?? null,
          owner: l.owner,
          title: l.title,
          description: l.description,
          district: l.district,
          latitude: l.latitude,
          longitude: l.longitude,
          basePriceThb: parseFloat(l.basePriceThb),
          commissionRate: parseFloat(l.commissionRate),
          images: l.images || [],
          coverImage: l.coverImage,
          metadata: l.metadata || {},
          rating: parseFloat(l.rating) || 0,
          reviewsCount: l.reviewsCount || 0,
          seasonalPricing,
          dbSeasonalPrices: seasonalPricesRaw.map((sp) => ({
            start_date: String(sp.startDate || sp.start_date || '').slice(0, 10),
            end_date: String(sp.endDate || sp.end_date || '').slice(0, 10),
            price_daily: parseFloat(sp.priceDaily ?? sp.price_daily) || 0,
            label: sp.label,
            season_type: sp.seasonType || sp.season_type,
          })),
          minStay: l.minBookingDays || 1,
          city: l.city,
          category_id: l.categoryId,
          categorySlug: l.category?.slug || null,
          maxCapacity: (() => {
            const raw = l.maxCapacity ?? l.max_capacity
            const n = parseInt(raw, 10)
            return Number.isFinite(n) && n > 0 ? n : null
          })(),
          cancellationPolicy: l.cancellationPolicy ?? l.cancellation_policy ?? 'moderate',
          partnerTrust: l.partnerTrust ?? null,
          catalog_flash_urgency: l.catalog_flash_urgency ?? null,
          catalog_flash_social_proof: l.catalog_flash_social_proof ?? null,
        })
      }
      setLoading(false)
    } catch (error) {
      console.error('Failed to load listing:', error)
      setLoading(false)
    }
  }
  
  const showContactPartner =
    !!listingPartnerId && String(user?.id || '') !== String(listingPartnerId)

  async function handleContactPartner() {
    const partnerId = listing?.ownerId ?? listing?.owner?.id
    if (!partnerId) {
      toast.error(getUIText('listingDetail_listingUnavailable', language))
      return
    }
    if (!user) {
      openLoginModal()
      return
    }
    if (String(user.id) === String(partnerId)) return

    // If we already know the conversation ID — go straight there
    if (existingConvId) {
      setRenterInboxTabPreference(INBOX_TAB_TRAVELING)
      router.push(`/messages/${encodeURIComponent(existingConvId)}`)
      return
    }

    setContactPartnerLoading(true)
    try {
      const res = await fetch('/api/v2/chat/conversations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: listing.id,
          partnerId,
          sendIntro: false,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        toast.error(json.error || getUIText('listingDetail_chatOpenError', language))
        return
      }
      const id = json.data?.id
      if (id) {
        const title = listing.title || getUIText('listingDetail_listingNameFallback', language)
        const draft = getUIText('listingDetail_chatIntro', language).replace(
          /\{\{title\}\}/g,
          String(title).replace(/</g, '').slice(0, 200),
        )
        try {
          setRenterInboxTabPreference(INBOX_TAB_TRAVELING)
          sessionStorage.setItem(`gostaylo_chat_prefill_${id}`, draft)
          sessionStorage.setItem(
            `gostaylo_chat_context_listing_${id}`,
            JSON.stringify({
              listingId: listing.id,
              title: listing.title || null,
              images: listing.images,
              district: listing.district || null,
            })
          )
        } catch {
          /* ignore */
        }
        setExistingConvId(id)
        router.push(`/messages/${encodeURIComponent(id)}`)
      }
    } catch (e) {
      console.error(e)
      toast.error(getUIText('listingDetail_networkError', language))
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
    } catch {
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
      toast.error(getUIText('listingToast_selectDates', language))
      return
    }

    setSubmitting(true)

    try {
      const isPrivateOrSpecial =
        bookingModalIntent === 'private' || bookingModalIntent === 'special'

      const payload = {
        listingId: listing.id,
        renterId: user.id,
        checkIn: isVehicleListing
          ? buildVehicleInstantIso(dateRange.from, vehicleStartTime)
          : format(dateRange.from, 'yyyy-MM-dd'),
        checkOut: isVehicleListing
          ? buildVehicleInstantIso(dateRange.to, vehicleEndTime)
          : format(dateRange.to, 'yyyy-MM-dd'),
        guestName,
        guestEmail,
        guestPhone,
        specialRequests: message?.trim() ? message.trim() : undefined,
        currency: 'THB',
        guestsCount: guests,
      }
      if (!isPrivateOrSpecial) {
        const sub = priceCalc?.subtotalBeforeFee ?? priceCalc?.totalPrice
        if (sub == null || !Number.isFinite(Number(sub))) {
          toast.error(getUIText('listingToast_priceCalc', language))
          setSubmitting(false)
          return
        }
        payload.clientQuotedSubtotalThb = Math.round(Number(sub))
        const ft = priceCalc?.finalTotal
        if (ft != null && Number.isFinite(Number(ft))) {
          payload.clientQuotedGuestTotalThb = Math.round(Number(ft))
        }
      }
      if (bookingModalIntent === 'private') payload.privateTrip = true
      if (bookingModalIntent === 'special') payload.negotiationRequest = true

      const res = await fetch('/api/v2/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
        cache: 'no-store',
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (data.success) {
        if (data.inquiry) {
          toast.success(getUIText('listingToast_bookingInquiry', language))
        } else {
          toast.success(getUIText('listingToast_bookingCreated', language))
        }
        setBookingModalOpen(false)
        setBookingModalIntent('book')
        const cid = data.conversationId
        if (cid) {
          router.push(`/messages/${encodeURIComponent(cid)}`, { scroll: false })
        } else if (!data.inquiry) {
          router.push('/renter/bookings', { scroll: false })
        }
      } else {
        toast.error(getBookingApiUserMessage(data, language))
      }
    } catch {
      toast.error(getUIText('listingToast_network', language))
    } finally {
      setSubmitting(false)
    }
  }
  
  const maxGuests = listing ? resolveListingGuestCapacity(listing) : 10

  const listingRentalPeriodMode = useMemo(
    () => (listing ? getListingRentalPeriodMode(listing.categorySlug) : 'night'),
    [listing?.categorySlug],
  )
  const amenities = listing?.metadata?.amenities || []

  const bookingUiMode = useMemo(
    () => getListingBookingUiMode(listing?.categorySlug, listing?.maxCapacity, listing?.metadata),
    [listing?.categorySlug, listing?.maxCapacity, listing?.metadata]
  )

  const wholeVesselListing = useMemo(
    () => isWholeVesselListing(listing?.categorySlug, listing?.metadata),
    [listing?.categorySlug, listing?.metadata]
  )

  const durationDiscountPercentActive = useMemo(() => {
    if (!listing?.metadata?.discounts || !dateRange?.from || !dateRange?.to) return 0
    const nights = differenceInDays(dateRange.to, dateRange.from)
    if (nights < 1) return 0
    const tiers = parseDurationDiscountTiers(listing.metadata.discounts)
    return computeBestDurationDiscountPercent(nights, tiers)
  }, [listing?.metadata?.discounts, dateRange?.from, dateRange?.to])

  const hasDurationDiscountTiers = useMemo(() => {
    const tiers = parseDurationDiscountTiers(listing?.metadata?.discounts)
    return tiers.length > 0
  }, [listing?.metadata?.discounts])

  const exclusiveDatesUnavailable =
    bookingUiMode === 'exclusive' &&
    !availabilityLoading &&
    !!availabilitySnapshot &&
    !!dateRange?.from &&
    !!dateRange?.to &&
    availabilitySnapshot.available === false

  const canInstantBook = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to || availabilityLoading) return false
    if (!availabilitySnapshot) return false
    if (bookingUiMode === 'exclusive') return !!availabilitySnapshot.available
    const rem = availabilitySnapshot.remaining_spots ?? 0
    return !!availabilitySnapshot.available && guests <= rem
  }, [dateRange, availabilityLoading, availabilitySnapshot, bookingUiMode, guests])

  function openBookModal(intent = 'book') {
    setBookingModalIntent(intent)
    setBookingModalOpen(true)
  }

  function handleAskPartnerUnavailable() {
    if (!dateRange?.from || !dateRange?.to) {
      toast.error(getUIText('listingDetail_selectDates', language))
      return
    }
    if (!user) {
      openLoginModal()
      return
    }
    openBookModal('special')
  }
  
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
        toast.error(getUIText('listingDetail_favoriteError', language))
      } else {
        toast.success(
          newState
            ? getUIText('listingDetail_favoriteAdded', language)
            : getUIText('listingDetail_favoriteRemoved', language),
        )
      }
    } catch {
      setIsFavorite(!newState)
      toast.error(getUIText('listingDetail_networkError', language))
    } finally {
      setFavoriteLoading(false)
    }
  }
  
  const galleryImageUrls = useMemo(() => getListingDisplayImageUrls(listing), [listing])

  if (loading) {
    return <ListingPageSkeleton />
  }

  if (!listing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">
            {getUIText('listingDetail_notFound', language)}
          </h2>
          <Button onClick={() => router.push('/listings')} variant="outline">
            {getUIText('listingDetail_backToListings', language)}
          </Button>
        </div>
      </div>
    )
  }
  
  return (
    <>
      <div className="min-h-screen bg-white">
        {/* Header */}
        <ListingPageNav
          language={language}
          onBack={() => router.back()}
          isFavorite={isFavorite}
          favoriteLoading={favoriteLoading}
          onFavorite={handleFavoriteClick}
        />

        <main
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-40 lg:pb-8"
        >
          <ListingGallery
            listing={listing}
            language={language}
            onImageClick={(index) => {
              setGalleryIndex(typeof index === 'number' ? index : 0)
              setGalleryOpen(true)
            }}
          />

          {shouldShowFlashUrgencyTimerAboveStrip(
            listing.catalog_flash_urgency,
            listing.catalog_flash_social_proof,
          ) ? (
            <div className="mt-3 max-w-2xl">
              <UrgencyTimer endsAt={listing.catalog_flash_urgency.ends_at} language={language} />
            </div>
          ) : null}

          <ListingFlashHotStrip
            catalog_flash_urgency={listing.catalog_flash_urgency}
            catalog_flash_social_proof={listing.catalog_flash_social_proof}
            language={language}
            className="mt-2 max-w-2xl"
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2 space-y-8">
              <ListingHeader listing={listing} language={language} />
              <Separator />
              <ListingDescription listing={listing} language={language} />
              
              {/* Mobile inline calendar */}
              <div className="lg:hidden">
                <h2 className="text-2xl font-medium tracking-tight mb-4">
                  {getUIText('selectYourDates', language)}
                </h2>
                <Card className="border-slate-200 bg-slate-50">
                  <CardContent className="p-4 space-y-4">
                    <div>
                      <Label className="text-sm font-medium mb-2 block">
                        {getUIText(
                          listingRentalPeriodMode === 'day' ? 'travelDatesRental' : 'travelDates',
                          language,
                        )}
                      </Label>
                      <GostayloCalendar
                        key={calendarKey}
                        listingId={listing.id}
                        value={dateRange}
                        onChange={setDateRange}
                        minStay={listing.minStay}
                        language={language}
                        guests={guests}
                        listingMaxCapacity={listing.maxCapacity}
                        rentalPeriodMode={listingRentalPeriodMode}
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-2 block">
                        {getUIText(
                          listingRentalPeriodMode === 'day' ? 'numberOfSeats' : 'numberOfGuests',
                          language,
                        )}
                      </Label>
                      <GuestCountStepper
                        value={guests}
                        onChange={setGuests}
                        min={1}
                        max={maxGuests}
                      />
                    </div>
                    {hasDurationDiscountTiers && durationDiscountPercentActive > 0 && (
                      <div className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-sm text-emerald-900">
                        <span>
                          {getUIText(
                            listingRentalPeriodMode === 'day'
                              ? 'durationDiscountTeaserActiveDay'
                              : 'durationDiscountTeaserActiveNight',
                            language,
                          ).replace(/\{\{pct\}\}/g, String(durationDiscountPercentActive))}
                        </span>
                      </div>
                    )}
                    {wholeVesselListing && dateRange?.from && dateRange?.to && (
                      <div className="text-sm text-teal-900 bg-teal-50/80 border border-teal-100 rounded-lg px-3 py-2">
                        {availabilityLoading ? (
                          <span>{getUIText('listingDetail_checkingAvailability', language)}</span>
                        ) : availabilitySnapshot != null ? (
                          <span>
                            {availabilitySnapshot.available
                              ? getUIText('listingDetail_vesselAvailable', language)
                              : getUIText('listingDetail_vesselUnavailable', language)}
                          </span>
                        ) : null}
                      </div>
                    )}
                    {bookingUiMode === 'shared' && !wholeVesselListing && dateRange?.from && dateRange?.to && (
                      <div className="text-sm text-teal-900 bg-teal-50/80 border border-teal-100 rounded-lg px-3 py-2">
                        {availabilityLoading ? (
                          <span>{getUIText('listingDetail_checkingSpots', language)}</span>
                        ) : availabilitySnapshot?.remaining_spots != null ? (
                          <span>
                            {getUIText('listingDetail_spotsLabel', language)}:{' '}
                            <strong>{availabilitySnapshot.remaining_spots}</strong>
                            {listing.maxCapacity > 1 ? ` / ${listing.maxCapacity}` : ''}
                          </span>
                        ) : null}
                      </div>
                    )}
                    {exclusiveDatesUnavailable && (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                        {getUIText('listingDetail_datesUnavailable', language)}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full mt-2 border-teal-300"
                          onClick={handleAskPartnerUnavailable}
                        >
                          {getUIText('listingDetail_askPartnerChat', language)}
                        </Button>
                      </div>
                    )}
                    {bookingUiMode === 'shared' && dateRange?.from && dateRange?.to && (
                      <div className="flex flex-col gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          className="w-full border border-teal-200"
                          onClick={() => (user ? openBookModal('private') : openLoginModal())}
                        >
                          {getUIText('listingDetail_privateTrip', language)}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full border-dashed"
                          onClick={() => (user ? openBookModal('special') : openLoginModal())}
                        >
                          {getUIText('listingDetail_specialPrice', language)}
                        </Button>
                      </div>
                    )}
                    {priceCalc && (
                      <div className="bg-white p-4 rounded-lg">
                        <PriceBreakdownBlock
                          priceCalc={priceCalc}
                          currency={currency}
                          exchangeRates={exchangeRates}
                          language={language}
                          rentalPeriodMode={listingRentalPeriodMode}
                        />
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
                  {getUIText('whereYoullBe', language, {
                    listingCategorySlug: listing?.categorySlug || listing?.category?.slug,
                  })}
                </h2>
                <ListingMap
                  latitude={listing.latitude}
                  longitude={listing.longitude}
                  title={listing.title}
                  district={listing.district}
                  language={language}
                  categoryId={listing.category_id}
                  categorySlug={listing.categorySlug}
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
                onBookingClick={() => openBookModal('book')}
                showAskPartner={showContactPartner && !exclusiveDatesUnavailable}
                onAskPartner={handleContactPartner}
                onAskPartnerUnavailable={handleAskPartnerUnavailable}
                askPartnerLoading={contactPartnerLoading}
                hasExistingConversation={!!existingConvId}
                lastMessagePreview={lastMessagePreview}
                hasUnreadFromHost={hasUnreadFromHost}
                bookingUiMode={bookingUiMode}
                vehicleStartTime={vehicleStartTime}
                vehicleEndTime={vehicleEndTime}
                onVehicleStartTimeChange={setVehicleStartTime}
                onVehicleEndTimeChange={setVehicleEndTime}
                availabilityLoading={availabilityLoading}
                availabilitySnapshot={availabilitySnapshot}
                durationDiscountPercentActive={durationDiscountPercentActive}
                showDurationDiscountTeaser={hasDurationDiscountTiers}
                onPrivateTripClick={
                  bookingUiMode === 'shared'
                    ? () => {
                        if (!user) {
                          openLoginModal()
                          return
                        }
                        openBookModal('private')
                      }
                    : undefined
                }
                onSpecialPriceClick={
                  bookingUiMode === 'shared'
                    ? () => {
                        if (!user) {
                          openLoginModal()
                          return
                        }
                        openBookModal('special')
                      }
                    : undefined
                }
                canInstantBook={canInstantBook}
                exclusiveDatesUnavailable={exclusiveDatesUnavailable}
              />

              <MobileBookingBar
                listing={listing}
                priceCalc={priceCalc}
                dateRange={dateRange}
                currency={currency}
                exchangeRates={exchangeRates}
                language={language}
                onBookingClick={() => openBookModal('book')}
                showAskPartner={showContactPartner && !exclusiveDatesUnavailable}
                onAskPartner={handleContactPartner}
                onAskPartnerUnavailable={handleAskPartnerUnavailable}
                askPartnerLoading={contactPartnerLoading}
                hasExistingConversation={!!existingConvId}
                lastMessagePreview={lastMessagePreview}
                hasUnreadFromHost={hasUnreadFromHost}
                bookingUiMode={bookingUiMode}
                availabilityLoading={availabilityLoading}
                canInstantBook={canInstantBook}
                exclusiveDatesUnavailable={exclusiveDatesUnavailable}
                onPrivateTripClick={
                  bookingUiMode === 'shared'
                    ? () => {
                        if (!user) {
                          openLoginModal()
                          return
                        }
                        openBookModal('private')
                      }
                    : undefined
                }
                onSpecialPriceClick={
                  bookingUiMode === 'shared'
                    ? () => {
                        if (!user) {
                          openLoginModal()
                          return
                        }
                        openBookModal('special')
                      }
                    : undefined
                }
              />
            </div>
          </div>
        </main>
        
        <GalleryModal
          open={galleryOpen}
          onOpenChange={setGalleryOpen}
          images={galleryImageUrls}
          currentIndex={galleryIndex}
          onIndexChange={setGalleryIndex}
          listingTitle={listing.title}
        />
        
        <BookingModal
          open={bookingModalOpen}
          onOpenChange={(open) => {
            setBookingModalOpen(open)
            if (!open) setBookingModalIntent('book')
          }}
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
          modalIntent={bookingModalIntent}
          listingCategorySlug={listing?.categorySlug}
          vehicleStartTime={vehicleStartTime}
          vehicleEndTime={vehicleEndTime}
          setVehicleStartTime={setVehicleStartTime}
          setVehicleEndTime={setVehicleEndTime}
        />
      </div>
    </>
  )
}

export default function PremiumListingPage({ params }) {
  return (
    <Suspense
      fallback={<ListingPageSkeleton />}
    >
      <PremiumListingContent params={params} />
    </Suspense>
  )
}
