'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { format, differenceInDays } from 'date-fns'
import { getUIText } from '@/lib/translations'
import {
  parseDurationDiscountTiers,
  computeBestDurationDiscountPercent,
} from '@/lib/listing/duration-discount-tiers.js'
import {
  getListingBookingUiMode,
  getListingRentalPeriodMode,
  isWholeVesselListing,
} from '@/lib/listing-booking-ui'
import { isTransportListingCategory } from '@/lib/listing-category-slug'
import { useCommission } from '@/hooks/use-commission'
import { useListingPricing } from '@/hooks/pricing/useListingPricing'
import { resolveListingGuestCapacity } from '@/lib/listing-guest-capacity'
import { getBookingApiUserMessage } from '@/lib/booking-error-message'

/**
 * PDP: dates in URL, availability polling, commission/pricing, booking modal + POST /api/v2/bookings.
 */
export function useListingBookingFlow({
  listing,
  user,
  openLoginModal,
  language,
  currency,
  exchangeRates,
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const urlBookingSyncEnabledRef = useRef(false)

  const [bookingModalOpen, setBookingModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
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
  const [availabilitySnapshot, setAvailabilitySnapshot] = useState(null)
  const [availabilityFetchLoading, setAvailabilityFetchLoading] = useState(false)
  const [bookingModalIntent, setBookingModalIntent] = useState('book')

  const listingPartnerId = listing?.ownerId ?? listing?.owner?.id ?? null
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

    if (guestsParam) setGuests(parseInt(guestsParam, 10) || 2)
    if (checkInTimeParam) setVehicleStartTime(checkInTimeParam)
    if (checkOutTimeParam) setVehicleEndTime(checkOutTimeParam)
  }, [searchParams, parseCalendarDay])

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
    )
      return

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
    fetch(`/api/v2/listings/${encodeURIComponent(listing.id)}/availability?${qs.toString()}`, {
      signal: ac.signal,
      credentials: 'omit',
    })
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

  useEffect(() => {
    if (user) {
      setGuestName(user.firstName || user.name || '')
      setGuestEmail(user.email || '')
      setGuestPhone(user.phone || '')
    }
  }, [user])

  const maxGuests = listing ? resolveListingGuestCapacity(listing) : 10

  const listingRentalPeriodMode = useMemo(
    () => (listing ? getListingRentalPeriodMode(listing.categorySlug) : 'night'),
    [listing?.categorySlug],
  )

  const bookingUiMode = useMemo(
    () => getListingBookingUiMode(listing?.categorySlug, listing?.maxCapacity, listing?.metadata),
    [listing?.categorySlug, listing?.maxCapacity, listing?.metadata],
  )

  const wholeVesselListing = useMemo(
    () => isWholeVesselListing(listing?.categorySlug, listing?.metadata),
    [listing?.categorySlug, listing?.metadata],
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

  const handleBookingSubmit = useCallback(
    async (e) => {
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
    },
    [
      user,
      dateRange,
      listing,
      bookingModalIntent,
      isVehicleListing,
      buildVehicleInstantIso,
      vehicleStartTime,
      vehicleEndTime,
      guestName,
      guestEmail,
      guestPhone,
      message,
      guests,
      priceCalc,
      language,
      openLoginModal,
      router,
    ],
  )

  return {
    dateRange,
    setDateRange,
    guests,
    setGuests,
    vehicleStartTime,
    setVehicleStartTime,
    vehicleEndTime,
    setVehicleEndTime,
    message,
    setMessage,
    calendarKey,
    bookingModalOpen,
    setBookingModalOpen,
    bookingModalIntent,
    setBookingModalIntent,
    submitting,
    guestName,
    setGuestName,
    guestEmail,
    setGuestEmail,
    guestPhone,
    setGuestPhone,
    priceCalc,
    availabilityLoading,
    availabilitySnapshot,
    listingRentalPeriodMode,
    bookingUiMode,
    wholeVesselListing,
    durationDiscountPercentActive,
    hasDurationDiscountTiers,
    exclusiveDatesUnavailable,
    canInstantBook,
    maxGuests,
    isVehicleListing,
    openBookModal,
    handleAskPartnerUnavailable,
    handleBookingSubmit,
  }
}
