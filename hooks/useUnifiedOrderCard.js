'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { getUIText } from '@/lib/translations'
import { shouldAllowCheckInToday, shouldAllowReviewByLifecycle } from '@/lib/orders/order-timeline'
import { canOpenOfficialDispute } from '@/lib/disputes/dispute-eligibility'
import { resolveEmergencyServiceKindFromListing } from '@/lib/emergency-contact-protocol'
import { inferListingServiceTypeFromCategorySlug } from '@/lib/partner/listing-service-type'
import {
  normalizeRole,
  normalizeUnifiedOrder,
  canRenterCancel,
  canPartnerConfirm,
  canPartnerComplete,
  resolveBookingConversationPreview,
  resolveBookingConversationStripUnread,
} from '@/lib/orders/unified-order-card-model'

export function useUnifiedOrderCard({
  booking,
  unifiedOrder,
  role = 'renter',
  language = 'ru',
  onConfirm,
  onDecline,
  onCancel,
  onReview,
  onCheckIn,
  onComplete,
}) {
  const [helpOpen, setHelpOpen] = useState(false)
  const [helpStep, setHelpStep] = useState('main')
  const [mediationUnlockAt, setMediationUnlockAt] = useState(null)
  const [mediationTick, setMediationTick] = useState(0)
  const [helpNudgeSending, setHelpNudgeSending] = useState(false)
  const [emergencySending, setEmergencySending] = useState(false)
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false)
  const [emergencyRateBlocked, setEmergencyRateBlocked] = useState(false)
  const [supportEscalating, setSupportEscalating] = useState(false)
  const [emergencyCheck, setEmergencyCheck] = useState({
    health_or_safety: false,
    no_property_access: false,
    disaster: false,
  })
  const [emergencyCtx, setEmergencyCtx] = useState(null)
  const [emergencyCtxReady, setEmergencyCtxReady] = useState(false)
  const router = useRouter()
  const [disputeSubmitting, setDisputeSubmitting] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
  const [disputeEvidenceFiles, setDisputeEvidenceFiles] = useState([])
  const disputeEvidenceInputRef = useRef(null)
  const [photoLightboxIndex, setPhotoLightboxIndex] = useState(null)
  const [partnerFinanceOpen, setPartnerFinanceOpen] = useState(false)

  const normalizedRole = normalizeRole(role)
  const normalizedOrder = normalizeUnifiedOrder(booking, unifiedOrder)
  const listing = booking?.listing || booking?.listings || {}
  const partnerTrustPublic = booking?.partner_trust || null
  const listingCategorySlugForPickup = String(listing?.category_slug || listing?.category?.slug || '').toLowerCase()
  const pickupServiceKind = inferListingServiceTypeFromCategorySlug(listingCategorySlugForPickup)

  const checkInInstructionsText = useMemo(() => {
    const m = booking?.metadata
    const obj = m && typeof m === 'object' && !Array.isArray(m) ? m : {}
    const s = obj.check_in_instructions
    return typeof s === 'string' ? s.trim() : ''
  }, [booking?.metadata])

  const checkInPhotoUrls = useMemo(() => {
    const m = booking?.metadata
    const obj = m && typeof m === 'object' && !Array.isArray(m) ? m : {}
    const raw = obj.check_in_photos
    if (!Array.isArray(raw)) return []
    return raw
      .map((u) => (typeof u === 'string' ? u.trim() : ''))
      .filter((u) => /^https?:\/\//i.test(u))
      .slice(0, 3)
  }, [booking?.metadata])

  useEffect(() => {
    if (photoLightboxIndex == null) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setPhotoLightboxIndex(null)
      if (e.key === 'ArrowRight' && checkInPhotoUrls.length > 1) {
        setPhotoLightboxIndex((i) => ((i ?? 0) + 1) % checkInPhotoUrls.length)
      }
      if (e.key === 'ArrowLeft' && checkInPhotoUrls.length > 1) {
        setPhotoLightboxIndex((i) => ((i ?? 0) - 1 + checkInPhotoUrls.length) % checkInPhotoUrls.length)
      }
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [photoLightboxIndex, checkInPhotoUrls.length])

  const emergencyServiceKind = useMemo(() => {
    const api = emergencyCtx?.emergencyServiceKind
    if (api === 'transport' || api === 'service' || api === 'tour' || api === 'stay') return api
    return resolveEmergencyServiceKindFromListing(listing)
  }, [listing, emergencyCtx?.emergencyServiceKind])

  const emergencyAccessCheckKey = useMemo(() => {
    if (emergencyServiceKind === 'transport') return 'orderHelp_emergencyCheck_access_transport'
    if (emergencyServiceKind === 'service') return 'orderHelp_emergencyCheck_access_service'
    return 'orderHelp_emergencyCheck_access'
  }, [emergencyServiceKind])

  const debugEmergencyAlways =
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_EMERGENCY_ALWAYS_VISIBLE === 'true'

  const title = listing?.title || getUIText('myBookings_listingFallback', language)
  const district = listing?.district
  const checkIn = normalizedOrder.dates.check_in
  const checkOut = normalizedOrder.dates.check_out
  const conversationId = booking?.conversationId || booking?.conversation_id || null
  const bookingId = String(booking?.id || normalizedOrder.id || '')
  const status = normalizedOrder.status
  const guestName =
    booking?.guestName ||
    [booking?.renter?.first_name, booking?.renter?.last_name].filter(Boolean).join(' ') ||
    'Гость'
  const guestPhone = booking?.guestPhone || booking?.renter?.phone || null
  const guestEmail = booking?.guestEmail || booking?.renter?.email || null
  const listingImage = listing?.images?.[0] || listing?.coverImage || listing?.cover_image || null
  const partnerEarnings = Number(booking?.partnerEarningsThb ?? booking?.partner_earnings_thb)
  const hasUnifiedTotal = Number.isFinite(normalizedOrder.total_price)
  const listingId = listing?.id || booking?.listing_id || null
  const reviewed =
    booking?.hasReview === true ||
    booking?.has_review === true ||
    booking?.reviewed === true ||
    booking?.review_submitted === true

  useEffect(() => {
    if (!mediationUnlockAt) return undefined
    const id = setInterval(() => setMediationTick((n) => n + 1), 10_000)
    return () => clearInterval(id)
  }, [mediationUnlockAt])

  const mediationLockActive =
    normalizedRole === 'renter' && mediationUnlockAt && Date.now() < new Date(mediationUnlockAt).getTime()
  void mediationTick

  useEffect(() => {
    setEmergencyCtx(null)
    setEmergencyCtxReady(false)
    if (normalizedRole !== 'renter' || !bookingId) return undefined
    let cancelled = false
    async function loadEmergencyCtx() {
      try {
        const res = await fetch(`/api/v2/bookings/${encodeURIComponent(bookingId)}/emergency-context`, {
          credentials: 'include',
        })
        const json = await res.json().catch(() => ({}))
        if (cancelled) return
        if (res.ok && json.success && json.data) {
          setEmergencyCtx(json.data)
        } else {
          setEmergencyCtx({ bookingEligible: false, partnerInQuietHours: false, emergencyServiceKind: 'stay' })
        }
      } catch {
        if (!cancelled)
          setEmergencyCtx({ bookingEligible: false, partnerInQuietHours: false, emergencyServiceKind: 'stay' })
      } finally {
        if (!cancelled) setEmergencyCtxReady(true)
      }
    }
    setEmergencyCtxReady(false)
    void loadEmergencyCtx()
    const id = setInterval(() => void loadEmergencyCtx(), 120_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [bookingId, normalizedRole, status, checkOut])

  const disputeEligibility = canOpenOfficialDispute({ status, checkInIso: checkIn, checkOutIso: checkOut })
  const supportChatHref = conversationId ? `/messages/${encodeURIComponent(conversationId)}` : null

  const showRenterCancel = normalizedRole === 'renter' && canRenterCancel(status) && typeof onCancel === 'function'
  const showRenterReview =
    normalizedRole === 'renter' &&
    shouldAllowReviewByLifecycle(status, checkOut) &&
    typeof onReview === 'function'
  const showRenterCheckIn =
    normalizedRole === 'renter' &&
    shouldAllowCheckInToday(status, checkIn) &&
    typeof onCheckIn === 'function'
  const showRepeatBooking =
    normalizedRole === 'renter' && ['COMPLETED', 'FINISHED', 'THAWED'].includes(status) && !!listingId
  const showPartnerConfirm =
    normalizedRole === 'partner' && canPartnerConfirm(status) && typeof onConfirm === 'function'
  const showPartnerDecline =
    normalizedRole === 'partner' && canPartnerConfirm(status) && typeof onDecline === 'function'
  const showPartnerComplete =
    normalizedRole === 'partner' && canPartnerComplete(status) && typeof onComplete === 'function'

  const canSubmitEmergency =
    emergencyCheck.health_or_safety || emergencyCheck.no_property_access || emergencyCheck.disaster

  function openEmergencyChecklistModal() {
    setEmergencyRateBlocked(false)
    setEmergencyCheck({ health_or_safety: false, no_property_access: false, disaster: false })
    setEmergencyModalOpen(true)
  }

  async function handleEmergencySupportAfterLimit() {
    if (!bookingId) return
    setSupportEscalating(true)
    try {
      const res = await fetch(`/api/v2/bookings/${encodeURIComponent(bookingId)}/emergency-support-ticket`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang: language }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        toast.error(json.error || getUIText('orderHelp_emergencySupportError', language))
        return
      }
      const cid = json.data?.conversationId
      if (!cid) {
        toast.error(getUIText('orderHelp_emergencySupportError', language))
        return
      }
      setEmergencyModalOpen(false)
      setEmergencyRateBlocked(false)
      router.push(`/messages/${encodeURIComponent(String(cid))}`)
    } catch {
      toast.error(getUIText('orderHelp_emergencySupportError', language))
    } finally {
      setSupportEscalating(false)
    }
  }

  async function handleEmergencySubmit() {
    if (!bookingId || !canSubmitEmergency) return
    setEmergencySending(true)
    try {
      const res = await fetch(`/api/v2/bookings/${encodeURIComponent(bookingId)}/emergency-contact`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklist: emergencyCheck }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.status === 429 && json.code === 'EMERGENCY_RATE_LIMIT') {
        setEmergencyRateBlocked(true)
        return
      }
      if (!res.ok || !json.success) {
        toast.error(json.error || getUIText('orderHelp_emergencyError', language))
        return
      }
      toast.success(getUIText('orderHelp_emergencySent', language))
      setEmergencyModalOpen(false)
    } catch {
      toast.error(getUIText('orderHelp_emergencyError', language))
    } finally {
      setEmergencySending(false)
    }
  }

  async function handleNotifyPartnerHelp() {
    if (!bookingId) return
    setHelpNudgeSending(true)
    try {
      const res = await fetch(`/api/v2/bookings/${encodeURIComponent(bookingId)}/guest-help-partner-nudge`, {
        method: 'POST',
        credentials: 'include',
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        toast.error(json.error || getUIText('orderHelp_nudgeError', language))
        return
      }
      toast.success(getUIText('orderHelp_nudgeSent', language))
      setHelpStep('main')
    } catch {
      toast.error(getUIText('orderHelp_nudgeError', language))
    } finally {
      setHelpNudgeSending(false)
    }
  }

  async function handleCreateDispute() {
    if (!bookingId) return
    setDisputeSubmitting(true)
    try {
      const evidenceUrls = []
      for (const file of disputeEvidenceFiles) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('bucket', 'dispute-evidence')
        fd.append('folder', `booking-${bookingId.replace(/[^a-zA-Z0-9-_]/g, '')}`)
        const up = await fetch('/api/v2/upload', { method: 'POST', body: fd, credentials: 'include' })
        const uj = await up.json().catch(() => ({}))
        if (!up.ok || !uj.success || !uj.url) {
          toast.error(uj.error || getUIText('orderDispute_evidenceUploadError', language))
          return
        }
        evidenceUrls.push(String(uj.url))
      }
      const res = await fetch('/api/v2/disputes/create', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          conversationId,
          reason: disputeReason.trim(),
          category: 'booking_dispute',
          evidenceUrls,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        if (json.code === 'MEDIATION_WINDOW_ACTIVE') {
          const m = Number(json.minutesLeft) || 1
          toast.message(getUIText('orderDispute_mediationWait', language).replace('{{mins}}', String(m)))
          return
        }
        toast.error(json.error || getUIText('orderDispute_createError', language))
        return
      }
      if (json.phase === 'PENDING_MEDIATION' && json.unlockAt) {
        setMediationUnlockAt(String(json.unlockAt))
        toast.success(getUIText('orderDispute_mediationStarted', language))
        return
      }
      if (json.alreadyExists) {
        toast.message(getUIText('orderDispute_alreadyExists', language))
      } else {
        toast.success(getUIText('orderDispute_created', language))
      }
      setMediationUnlockAt(null)
      setHelpOpen(false)
      setDisputeReason('')
      setDisputeEvidenceFiles([])
    } catch {
      toast.error(getUIText('orderDispute_createError', language))
    } finally {
      setDisputeSubmitting(false)
    }
  }

  const lightboxUrl =
    photoLightboxIndex != null ? checkInPhotoUrls[photoLightboxIndex] || null : null
  const lastMessagePreview = resolveBookingConversationPreview(booking)
  const chatStripUnread = resolveBookingConversationStripUnread(booking)

  return {
    normalizedRole,
    normalizedOrder,
    listing,
    partnerTrustPublic,
    pickupServiceKind,
    checkInInstructionsText,
    checkInPhotoUrls,
    emergencyAccessCheckKey,
    debugEmergencyAlways,
    title,
    district,
    checkIn,
    checkOut,
    conversationId,
    bookingId,
    status,
    guestName,
    guestPhone,
    guestEmail,
    listingImage,
    partnerEarnings,
    hasUnifiedTotal,
    listingId,
    reviewed,
    mediationLockActive,
    disputeEligibility,
    supportChatHref,
    showRenterCancel,
    showRenterReview,
    showRenterCheckIn,
    showRepeatBooking,
    showPartnerConfirm,
    showPartnerDecline,
    showPartnerComplete,
    canSubmitEmergency,
    lightboxUrl,
    lastMessagePreview,
    chatStripUnread,
    helpOpen,
    setHelpOpen,
    helpStep,
    setHelpStep,
    helpNudgeSending,
    emergencySending,
    emergencyModalOpen,
    setEmergencyModalOpen,
    emergencyRateBlocked,
    supportEscalating,
    emergencyCheck,
    setEmergencyCheck,
    emergencyCtx,
    emergencyCtxReady,
    disputeSubmitting,
    disputeReason,
    setDisputeReason,
    disputeEvidenceFiles,
    setDisputeEvidenceFiles,
    disputeEvidenceInputRef,
    photoLightboxIndex,
    setPhotoLightboxIndex,
    partnerFinanceOpen,
    setPartnerFinanceOpen,
    openEmergencyChecklistModal,
    handleEmergencySupportAfterLimit,
    handleEmergencySubmit,
    handleNotifyPartnerHelp,
    handleCreateDispute,
    setMediationUnlockAt,
    setEmergencyRateBlocked,
  }
}
