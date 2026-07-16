import { useState, useEffect, useCallback } from 'react'
import { detectLanguage, DEFAULT_UI_LANGUAGE } from '@/lib/translations'

/**
 * Primary checkout loading: booking/invoice/access + language sync.
 */
export function useCheckoutLoadState({
  bookingId,
  invoiceIdParam,
  user,
  authLoading,
  setBooking,
  setListing,
  setInvoice,
  setPaymentSuccess,
  setChatConversationId,
  setUseWalletBonuses,
  setWalletUseThb,
}) {
  const [language, setLanguage] = useState(DEFAULT_UI_LANGUAGE)
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)

  useEffect(() => {
    const lang = detectLanguage()
    setLanguage(lang)
    const h = (e) => {
      if (e?.detail) setLanguage(e.detail)
    }
    window.addEventListener('language-change', h)
    window.addEventListener('languageChange', h)
    return () => {
      window.removeEventListener('language-change', h)
      window.removeEventListener('languageChange', h)
    }
  }, [])

  const loadPaymentStatus = useCallback(async () => {
    try {
      const bookingRes = await fetch(`/api/v2/bookings/${bookingId}`, { cache: 'no-store' })
      const bookingData = await bookingRes.json()

      if (!bookingData.success || !bookingData.data) {
        console.error('[CHECKOUT] Booking not found:', bookingData.error)
        setLoading(false)
        return
      }

      const b = bookingData.data
      const l = b.listings
      const categorySlug = String(
        l?.category_slug ||
          (l?.categories && !Array.isArray(l.categories) ? l.categories.slug : '') ||
          (Array.isArray(l?.categories) ? l.categories[0]?.slug : '') ||
          '',
      ).toLowerCase()
      const listingMeta =
        l?.metadata && typeof l.metadata === 'object' && !Array.isArray(l.metadata) ? l.metadata : {}

      const listingsForCheckout = l
        ? {
            id: l.id,
            title: l.title,
            district: l.district,
            images: l.images,
            cover_image: l.cover_image,
            category_slug: categorySlug,
            metadata: listingMeta,
          }
        : null

      setBooking({
        id: b.id,
        renter_id: b.renter_id,
        listing_id: b.listing_id,
        status: b.status,
        checkIn: b.check_in,
        checkOut: b.check_out,
        priceThb: parseFloat(b.price_thb),
        currency: b.currency || 'THB',
        guestName: b.guest_name,
        guestEmail: b.guest_email,
        guestPhone: b.guest_phone,
        specialRequests: b.special_requests,
        createdAt: b.created_at,
        metadata: b.metadata,
        commissionRate: parseFloat(b.commission_rate),
        commissionThb: parseFloat(b.commission_thb) || 0,
        partnerEarningsThb: parseFloat(b.partner_earnings_thb) || 0,
        roundingDiffPot: parseFloat(b.rounding_diff_pot) || 0,
        taxableMarginAmount: parseFloat(b.taxable_margin_amount) || 0,
        pricing_snapshot: b.pricing_snapshot ?? null,
        listings: listingsForCheckout,
      })
      const existingWalletDiscount = Math.max(0, Math.round(Number(b?.metadata?.wallet_discount_thb || 0)))
      if (existingWalletDiscount > 0) {
        setUseWalletBonuses(true)
        setWalletUseThb(existingWalletDiscount)
      }

      if (l) {
        setListing({
          id: l.id,
          title: l.title,
          district: l.district,
          coverImage: l.cover_image || l.images?.[0],
          basePriceThb: parseFloat(l.base_price_thb),
          category_slug: categorySlug,
          metadata: listingMeta,
        })
      }

      let resolvedInvoice = null
      if (invoiceIdParam) {
        try {
          const invRes = await fetch(`/api/v2/chat/invoice?id=${encodeURIComponent(invoiceIdParam)}`, {
            credentials: 'include',
            cache: 'no-store',
          })
          const invData = await invRes.json()
          if (invRes.ok && invData.success && Array.isArray(invData.invoices) && invData.invoices.length > 0) {
            resolvedInvoice = invData.invoices[0]
            setInvoice(resolvedInvoice)
          } else {
            setInvoice(null)
          }
        } catch {
          setInvoice(null)
        }
      } else {
        setInvoice(null)
      }

      if (b.status === 'PAID' || b.status === 'PAID_ESCROW' || b.status === 'COMPLETED') {
        setPaymentSuccess(true)
      }

      if (b.conversation_id) {
        setChatConversationId(b.conversation_id)
      } else {
        try {
          const convRes = await fetch(`/api/v2/chat/conversations?id=${encodeURIComponent(b.id)}&enrich=0`, {
            credentials: 'include',
          })
          const convJson = await convRes.json()
          const convId = convJson.data?.[0]?.id
          if (convId) setChatConversationId(convId)
          else {
            const convRes2 = await fetch('/api/v2/chat/conversations?enrich=0', { credentials: 'include' })
            const convJson2 = await convRes2.json()
            const matched = Array.isArray(convJson2.data)
              ? convJson2.data.find((c) => String(c.bookingId) === String(b.id))
              : null
            if (matched?.id) setChatConversationId(matched.id)
          }
        } catch {
          /* non-critical */
        }
      }

      // Keep for caller to use in intent flow.
      setLoading(false)
      return { booking: b, resolvedInvoice }
    } catch (error) {
      console.error('Failed to load payment status:', error)
      setLoading(false)
      return { booking: null, resolvedInvoice: null }
    }
  }, [
    bookingId,
    invoiceIdParam,
    setBooking,
    setListing,
    setInvoice,
    setPaymentSuccess,
    setChatConversationId,
    setUseWalletBonuses,
    setWalletUseThb,
  ])

  const evaluateAccess = useCallback(
    (booking, currentUser) => {
      if (authLoading || !booking) return
      if (booking.renter_id) {
        if (!currentUser?.id) {
          setAccessDenied(true)
          return
        }
        if (booking.renter_id !== currentUser.id) {
          setAccessDenied(true)
        }
      }
    },
    [authLoading],
  )

  return {
    language,
    loading,
    accessDenied,
    setAccessDenied,
    loadPaymentStatus,
    evaluateAccess,
  }
}

export default useCheckoutLoadState
