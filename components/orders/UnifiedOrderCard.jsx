'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ProxiedImage } from '@/components/proxied-image'
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  Check,
  Home,
  LifeBuoy,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Siren,
  Star,
  Image as ImageIcon,
  X,
} from 'lucide-react'
import { formatPrice } from '@/lib/currency'
import { getUIText } from '@/lib/translations'
import OrderTypeIcon from '@/components/ui/OrderTypeIcon'
import OrderStatusBadge from '@/components/ui/order-status-badge'
import OrderTimeline from '@/components/orders/OrderTimeline'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  normalizeOrderType,
  shouldAllowCheckInToday,
  shouldAllowReviewByLifecycle,
} from '@/lib/orders/order-timeline'
import { canOpenOfficialDispute } from '@/lib/disputes/dispute-eligibility'

function normalizeRole(role) {
  const value = String(role || '').trim().toLowerCase()
  if (value === 'partner' || value === 'admin') return value
  return 'renter'
}

function toIsoOrNull(value) {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function normalizeUnifiedOrder(booking, unifiedOrder) {
  const raw = unifiedOrder && typeof unifiedOrder === 'object' ? unifiedOrder : booking?.unified_order || {}
  return {
    id: String(raw?.id || booking?.id || ''),
    type: normalizeOrderType(raw?.type),
    status: String(raw?.status || booking?.status || '').toUpperCase(),
    total_price: Number(raw?.total_price),
    currency: String(raw?.currency || booking?.currency || 'THB').toUpperCase(),
    dates: {
      check_in: raw?.dates?.check_in || toIsoOrNull(booking?.checkIn || booking?.check_in),
      check_out: raw?.dates?.check_out || toIsoOrNull(booking?.checkOut || booking?.check_out),
    },
  }
}

function getOrderTypeLabel(type, language) {
  const normalized = normalizeOrderType(type)
  const lang = String(language || 'ru').toLowerCase()
  if (lang === 'en') {
    if (normalized === 'transport') return 'Transport'
    if (normalized === 'activity') return 'Activity'
    return 'Home'
  }
  if (lang === 'th') {
    if (normalized === 'transport') return 'การเดินทาง'
    if (normalized === 'activity') return 'กิจกรรม'
    return 'ที่พัก'
  }
  if (lang === 'zh') {
    if (normalized === 'transport') return '交通'
    if (normalized === 'activity') return '活动'
    return '住宿'
  }
  if (normalized === 'transport') return 'Транспорт'
  if (normalized === 'activity') return 'Активности'
  return 'Жильё'
}

function canRenterCancel(status) {
  return ['PENDING', 'CONFIRMED', 'AWAITING_PAYMENT'].includes(status)
}

function canPartnerConfirm(status) {
  return status === 'PENDING'
}

function canPartnerComplete(status) {
  return ['PAID', 'THAWED', 'CHECKED_IN'].includes(status)
}

function formatPayoutAfter(checkOut, language) {
  if (!checkOut) return '—'
  const d = new Date(checkOut)
  if (Number.isNaN(d.getTime())) return '—'
  const ts = d.getTime() + 24 * 60 * 60 * 1000
  const locale =
    language === 'en'
      ? 'en-US'
      : language === 'th'
        ? 'th-TH'
        : language === 'zh'
          ? 'zh-CN'
          : 'ru-RU'
  return new Date(ts).toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function UnifiedOrderCard({
  booking,
  unifiedOrder,
  role = 'renter',
  language = 'ru',
  isBusy = false,
  cardAnchorId = null,
  onConfirm = null,
  onDecline = null,
  onComplete = null,
  onCancel = null,
  onReview = null,
  onCheckIn = null,
}) {
  const [helpOpen, setHelpOpen] = useState(false)
  /** 'pre' = Stage 19 renter nudge to contact host before dispute path */
  const [helpStep, setHelpStep] = useState('main')
  /** ISO — renter mediation window (Stage 20); blocks second submit until elapsed */
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
  /** Stage 24.0 — server: lifecycle + partner quiet hours for emergency CTA */
  const [emergencyCtx, setEmergencyCtx] = useState(null)
  const [emergencyCtxReady, setEmergencyCtxReady] = useState(false)
  const router = useRouter()
  const [disputeSubmitting, setDisputeSubmitting] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
  const [disputeEvidenceFiles, setDisputeEvidenceFiles] = useState([])
  const disputeEvidenceInputRef = useRef(null)
  const normalizedRole = normalizeRole(role)
  const normalizedOrder = normalizeUnifiedOrder(booking, unifiedOrder)

  const listing = booking?.listing || booking?.listings || {}
  const title = listing?.title || 'Объект'
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
    normalizedRole === 'renter' &&
    mediationUnlockAt &&
    Date.now() < new Date(mediationUnlockAt).getTime()

  void mediationTick

  useEffect(() => {
    setEmergencyCtx(null)
    setEmergencyCtxReady(false)
    if (normalizedRole !== 'renter' || !bookingId) {
      return undefined
    }
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
          setEmergencyCtx({ bookingEligible: false, partnerInQuietHours: false })
        }
      } catch {
        if (!cancelled) setEmergencyCtx({ bookingEligible: false, partnerInQuietHours: false })
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

  const disputeEligibility = canOpenOfficialDispute({
    status,
    checkInIso: checkIn,
    checkOutIso: checkOut,
  })
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
    normalizedRole === 'renter' &&
    ['COMPLETED', 'FINISHED', 'THAWED'].includes(status) &&
    !!listingId

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
    setEmergencyCheck({
      health_or_safety: false,
      no_property_access: false,
      disaster: false,
    })
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
          toast.message(
            getUIText('orderDispute_mediationWait', language).replace('{{mins}}', String(m)),
          )
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

  return (
    <Card
      className="rounded-2xl overflow-hidden hover:shadow-md transition-shadow"
      data-booking-card={cardAnchorId || bookingId}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <OrderTypeIcon type={normalizedOrder.type} className="text-teal-700" />
              <span className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                {getOrderTypeLabel(normalizedOrder.type, language)}
              </span>
            </div>
            <CardTitle className="text-lg md:text-xl">{title}</CardTitle>
            <CardDescription className="mt-2 space-y-1">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>
                  {checkIn && checkOut
                    ? `${new Date(checkIn).toLocaleDateString('ru-RU')} — ${new Date(checkOut).toLocaleDateString('ru-RU')}`
                    : '—'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>{district ? `${district}, Thailand` : 'Thailand'}</span>
              </div>
            </CardDescription>
          </div>
          <OrderStatusBadge status={status} language={language} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <OrderTimeline
          status={status}
          type={normalizedOrder.type}
          language={language}
          reviewed={reviewed}
          checkOut={checkOut}
        />

        {normalizedRole === 'admin' && booking?.renter && booking?.partner ? (
          <div className="grid sm:grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Гость</p>
              <p className="font-medium text-slate-900 truncate">
                {[booking.renter.first_name, booking.renter.last_name].filter(Boolean).join(' ') ||
                  booking.renter.email ||
                  booking.renter.id}
              </p>
              {booking.renter.email ? <p className="text-xs text-slate-600 truncate">{booking.renter.email}</p> : null}
              {booking.renter.phone ? <p className="text-xs text-slate-600">{booking.renter.phone}</p> : null}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Партнёр</p>
              <p className="font-medium text-slate-900 truncate">
                {[booking.partner.first_name, booking.partner.last_name].filter(Boolean).join(' ') ||
                  booking.partner.email ||
                  booking.partner.id}
              </p>
              {booking.partner.email ? <p className="text-xs text-slate-600 truncate">{booking.partner.email}</p> : null}
              {booking.partner.phone ? <p className="text-xs text-slate-600">{booking.partner.phone}</p> : null}
            </div>
          </div>
        ) : null}

        {normalizedRole === 'renter' && ['PAID_ESCROW', 'CHECKED_IN', 'THAWED', 'COMPLETED', 'FINISHED'].includes(status) ? (
          <div className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">
            {getUIText('orderEscrow_guestProtected', language)}
          </div>
        ) : null}

        {normalizedRole === 'partner' && ['PAID_ESCROW', 'CHECKED_IN'].includes(status) ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
            {getUIText('orderEscrow_partnerInEscrow', language).replace(
              '{date}',
              formatPayoutAfter(checkOut, language),
            )}
          </div>
        ) : null}

        {normalizedRole === 'partner' && ['THAWED', 'COMPLETED', 'FINISHED'].includes(status) ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            {getUIText('orderEscrow_partnerReleased', language)}
          </div>
        ) : null}

        {normalizedRole === 'partner' ? (
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <div className="flex items-center gap-3 mb-2">
              <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                {listingImage ? (
                  <ProxiedImage src={listingImage} alt={title} fill className="object-cover" sizes="48px" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Home className="h-5 w-5 text-slate-300" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-slate-900 text-sm truncate">{guestName}</p>
                {booking?.guestRatingAverage != null ? (
                  <p className="text-xs text-amber-700 inline-flex items-center gap-1">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                    {Number(booking.guestRatingAverage).toFixed(1)}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
              {guestPhone ? (
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3 w-3 text-slate-400" />
                  <span>{guestPhone}</span>
                </div>
              ) : null}
              {guestEmail ? (
                <div className="flex items-center gap-1.5">
                  <Mail className="h-3 w-3 text-slate-400" />
                  <span className="truncate">{guestEmail}</span>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex items-start justify-between gap-3 pt-3 border-t">
          <div>
            <p className="text-sm text-slate-600 mb-1">
              {normalizedRole === 'partner' ? getUIText('netEarnings', language) : getUIText('checkout_total', language)}
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {hasUnifiedTotal ? formatPrice(normalizedOrder.total_price, normalizedOrder.currency) : '—'}
            </p>
          </div>
          {normalizedRole === 'partner' && Number.isFinite(partnerEarnings) ? (
            <div className="text-right">
              <p className="text-sm text-slate-500 mb-1">{getUIText('yourShare', language)}</p>
              <p className="text-lg font-semibold text-teal-700">{formatPrice(partnerEarnings, 'THB')}</p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {normalizedRole === 'admin' ? (
            <>
              {conversationId ? (
                <Button asChild variant="outline" className="border-teal-200 text-teal-800 hover:bg-teal-50">
                  <Link href={`/messages/${encodeURIComponent(conversationId)}`}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    {getUIText('bookingCard_openChat', language)}
                  </Link>
                </Button>
              ) : null}
              {bookingId ? (
                <Button asChild variant="outline">
                  <Link href={`/checkout/${encodeURIComponent(bookingId)}`}>{getUIText('orderAction_details', language)}</Link>
                </Button>
              ) : null}
            </>
          ) : null}

          {normalizedRole !== 'admin' && conversationId ? (
            <Button asChild variant="outline" className="border-teal-200 text-teal-800 hover:bg-teal-50">
              <Link href={`/messages/${encodeURIComponent(conversationId)}`}>
                <MessageSquare className="h-4 w-4 mr-2" />
                {getUIText('bookingCard_openChat', language)}
              </Link>
            </Button>
          ) : null}

          {normalizedRole !== 'admin' && normalizedRole !== 'partner' && bookingId ? (
            <Button asChild variant="outline">
              <Link href={`/checkout/${encodeURIComponent(bookingId)}`}>
                {getUIText('orderAction_details', language)}
              </Link>
            </Button>
          ) : null}

          {showRenterCancel ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => onCancel?.(booking)}
              disabled={isBusy}
              className="text-red-700 border-red-200 hover:bg-red-50"
            >
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : getUIText('orderAction_cancel', language)}
            </Button>
          ) : null}

          {showRenterCheckIn ? (
            <Button type="button" onClick={() => onCheckIn?.(booking)} disabled={isBusy} className="bg-teal-600 hover:bg-teal-700">
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : getUIText('orderAction_checkIn', language)}
            </Button>
          ) : null}

          {showRenterReview ? (
            <Button type="button" onClick={() => onReview?.(booking)} disabled={isBusy} className="bg-teal-600 hover:bg-teal-700">
              <Star className="h-4 w-4 mr-2" />
              {getUIText('orderAction_review', language)}
            </Button>
          ) : null}

          {showRepeatBooking ? (
            <Button asChild variant="outline">
              <Link href={`/listings/${encodeURIComponent(String(listingId))}`}>
                {getUIText('orderAction_repeatBooking', language)}
              </Link>
            </Button>
          ) : null}

          {normalizedRole !== 'admin' && bookingId ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setHelpStep(normalizedRole === 'renter' ? 'pre' : 'main')
                setHelpOpen(true)
              }}
            >
              <LifeBuoy className="h-4 w-4 mr-2" />
              {getUIText('orderAction_help', language)}
            </Button>
          ) : null}

          {showPartnerConfirm ? (
            <Button type="button" onClick={() => onConfirm?.(booking)} disabled={isBusy} className="bg-green-600 hover:bg-green-700">
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              {getUIText('orderAction_confirm', language)}
            </Button>
          ) : null}

          {showPartnerDecline ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => onDecline?.(booking)}
              disabled={isBusy}
              className="text-red-700 border-red-200 hover:bg-red-50"
            >
              <X className="h-4 w-4 mr-2" />
              {getUIText('orderAction_decline', language)}
            </Button>
          ) : null}

          {showPartnerComplete ? (
            <Button type="button" variant="outline" onClick={() => onComplete?.(booking)} disabled={isBusy}>
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              {getUIText('orderAction_complete', language)}
            </Button>
          ) : null}
        </div>

        {normalizedRole !== 'admin' ? (
        <>
        <Dialog
          open={helpOpen}
          onOpenChange={(open) => {
            setHelpOpen(open)
            if (!open) {
              setDisputeEvidenceFiles([])
              setHelpStep('pre')
              setMediationUnlockAt(null)
              setEmergencyModalOpen(false)
            }
          }}
        >
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{getUIText('orderHelp_title', language)}</DialogTitle>
              <DialogDescription>{getUIText('orderHelp_description', language)}</DialogDescription>
            </DialogHeader>

            {helpStep === 'pre' && normalizedRole === 'renter' ? (
              <div className="space-y-3 rounded-xl border border-teal-200 bg-teal-50/80 p-4">
                <p className="text-sm font-semibold text-teal-950">{getUIText('orderHelp_preContactTitle', language)}</p>
                <p className="text-sm text-teal-900/90">{getUIText('orderHelp_preContactDesc', language)}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {supportChatHref ? (
                    <Button asChild variant="default" className="bg-teal-600 hover:bg-teal-700">
                      <Link href={supportChatHref}>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        {getUIText('orderHelp_openChat', language)}
                      </Link>
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    className="border-teal-400"
                    disabled={helpNudgeSending}
                    onClick={() => void handleNotifyPartnerHelp()}
                  >
                    {helpNudgeSending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {getUIText('orderHelp_notifyPartner', language)}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setHelpStep('main')}>
                    {getUIText('orderHelp_skipPreStep', language)}
                  </Button>
                </div>
              </div>
            ) : null}

            {helpStep !== 'pre' || normalizedRole !== 'renter' ? (
            <>
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-medium text-slate-900">{getUIText('orderHelp_level1Title', language)}</p>
              <p className="text-sm text-slate-700">{getUIText('orderHelp_level1Desc', language)}</p>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href="/help/escrow-protection">
                    <BookOpen className="h-4 w-4 mr-2" />
                    {getUIText('orderHelp_knowledgeBase', language)}
                  </Link>
                </Button>
                {supportChatHref ? (
                  <Button asChild variant="outline">
                    <Link href={supportChatHref}>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      {getUIText('orderHelp_openChat', language)}
                    </Link>
                  </Button>
                ) : null}
                {normalizedRole === 'renter' && bookingId && emergencyCtxReady && emergencyCtx?.bookingEligible ? (
                  <div className="w-full pt-2 border-t border-slate-200 mt-2 space-y-2">
                    {emergencyCtx?.partnerInQuietHours ? (
                      <>
                        <p className="text-xs text-slate-600">{getUIText('orderHelp_emergencyHint', language)}</p>
                        <Button
                          type="button"
                          variant="destructive"
                          className="bg-red-700 hover:bg-red-800"
                          disabled={emergencySending}
                          onClick={openEmergencyChecklistModal}
                        >
                          <Siren className="h-4 w-4 mr-2" />
                          {getUIText('orderHelp_emergencyContact', language)}
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-slate-600">{getUIText('orderHelp_emergencyDaytimeHint', language)}</p>
                        {supportChatHref ? (
                          <Button asChild variant="default" className="bg-teal-600 hover:bg-teal-700">
                            <Link href={supportChatHref}>
                              <MessageSquare className="h-4 w-4 mr-2" />
                              {getUIText('orderHelp_writeToPartnerChat', language)}
                            </Link>
                          </Button>
                        ) : null}
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-900">{getUIText('orderHelp_level2Title', language)}</p>
              {disputeEligibility.allowed ? (
                <>
                  <p className="text-sm text-amber-800">{getUIText('orderHelp_level2Allowed', language)}</p>
                  {mediationLockActive ? (
                    <p className="text-sm text-amber-950 bg-amber-100/80 border border-amber-300 rounded-lg px-3 py-2">
                      {getUIText('orderDispute_mediationActiveHint', language).replace(
                        '{{mins}}',
                        String(
                          Math.max(
                            1,
                            Math.ceil(
                              (new Date(mediationUnlockAt).getTime() - Date.now()) / 60_000,
                            ),
                          ),
                        ),
                      )}
                    </p>
                  ) : null}
                  <Textarea
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    placeholder={getUIText('orderDispute_reasonPlaceholder', language)}
                    maxLength={2000}
                    rows={4}
                  />
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-amber-900">{getUIText('partnerTrust_evidenceLabel', language)}</p>
                    <p className="text-xs text-amber-800/90">{getUIText('partnerTrust_evidenceHint', language)}</p>
                    <input
                      ref={disputeEvidenceInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const picked = Array.from(e.target.files || [])
                        e.target.value = ''
                        setDisputeEvidenceFiles((prev) => [...prev, ...picked].slice(0, 3))
                      }}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-amber-300"
                        onClick={() => disputeEvidenceInputRef.current?.click()}
                        disabled={disputeEvidenceFiles.length >= 3}
                      >
                        <ImageIcon className="h-4 w-4 mr-1.5" />
                        {getUIText('orderDispute_addPhotos', language)}
                      </Button>
                      {disputeEvidenceFiles.length > 0 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-amber-900"
                          onClick={() => setDisputeEvidenceFiles([])}
                        >
                          {getUIText('orderDispute_clearPhotos', language)}
                        </Button>
                      ) : null}
                    </div>
                    {disputeEvidenceFiles.length > 0 ? (
                      <ul className="text-xs text-amber-950 space-y-0.5 list-disc pl-4">
                        {disputeEvidenceFiles.map((f) => (
                          <li key={`${f.name}-${f.size}`}>{f.name}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="inline-flex items-center gap-2 text-sm text-amber-900">
                  <AlertTriangle className="h-4 w-4" />
                  <span>{getUIText(`orderDispute_blockReason_${disputeEligibility.reason}`, language)}</span>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setHelpOpen(false)}>
                {getUIText('orderHelp_close', language)}
              </Button>
              {disputeEligibility.allowed ? (
                <Button
                  type="button"
                  className="bg-amber-600 hover:bg-amber-700"
                  onClick={handleCreateDispute}
                  disabled={disputeSubmitting || mediationLockActive}
                >
                  {disputeSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {mediationLockActive
                    ? getUIText('orderDispute_mediationButtonWait', language)
                    : getUIText('orderHelp_openOfficialDispute', language)}
                </Button>
              ) : null}
            </DialogFooter>
            </>
            ) : (
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setHelpOpen(false)}>
                  {getUIText('orderHelp_close', language)}
                </Button>
                <Button type="button" onClick={() => setHelpStep('main')}>
                  {getUIText('orderHelp_continueSupport', language)}
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>

        <Dialog
          open={emergencyModalOpen}
          onOpenChange={(open) => {
            setEmergencyModalOpen(open)
            if (!open) setEmergencyRateBlocked(false)
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {emergencyRateBlocked
                  ? getUIText('orderHelp_emergencyRateLimitTitle', language)
                  : getUIText('orderHelp_emergencyModalTitle', language)}
              </DialogTitle>
              <DialogDescription>
                {emergencyRateBlocked
                  ? getUIText('orderHelp_emergencyRateLimited', language)
                  : getUIText('orderHelp_emergencyModalIntro', language)}
              </DialogDescription>
            </DialogHeader>
            {!emergencyRateBlocked ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 leading-relaxed">
                {getUIText('orderHelp_emergencyNightDisclaimer', language)}
              </div>
            ) : null}
            {emergencyRateBlocked ? (
              <div className="space-y-3 py-1">
                <Button
                  type="button"
                  variant="default"
                  className="w-full bg-teal-700 hover:bg-teal-800"
                  disabled={supportEscalating}
                  onClick={() => void handleEmergencySupportAfterLimit()}
                >
                  {supportEscalating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LifeBuoy className="h-4 w-4 mr-2" />}
                  {getUIText('orderHelp_emergencyWriteSupport', language)}
                </Button>
              </div>
            ) : (
              <div className="space-y-3 py-1">
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-sm text-slate-800">
                  <Checkbox
                    className="mt-0.5"
                    checked={emergencyCheck.health_or_safety}
                    onCheckedChange={(v) =>
                      setEmergencyCheck((c) => ({ ...c, health_or_safety: v === true }))
                    }
                    aria-label={getUIText('orderHelp_emergencyCheck_health', language)}
                  />
                  <span>{getUIText('orderHelp_emergencyCheck_health', language)}</span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-sm text-slate-800">
                  <Checkbox
                    className="mt-0.5"
                    checked={emergencyCheck.no_property_access}
                    onCheckedChange={(v) =>
                      setEmergencyCheck((c) => ({ ...c, no_property_access: v === true }))
                    }
                    aria-label={getUIText('orderHelp_emergencyCheck_access', language)}
                  />
                  <span>{getUIText('orderHelp_emergencyCheck_access', language)}</span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-sm text-slate-800">
                  <Checkbox
                    className="mt-0.5"
                    checked={emergencyCheck.disaster}
                    onCheckedChange={(v) => setEmergencyCheck((c) => ({ ...c, disaster: v === true }))}
                    aria-label={getUIText('orderHelp_emergencyCheck_disaster', language)}
                  />
                  <span>{getUIText('orderHelp_emergencyCheck_disaster', language)}</span>
                </label>
              </div>
            )}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setEmergencyModalOpen(false)}>
                {getUIText('orderHelp_close', language)}
              </Button>
              {emergencyRateBlocked ? null : (
                <Button
                  type="button"
                  variant="destructive"
                  className="bg-red-700 hover:bg-red-800"
                  disabled={emergencySending || !canSubmitEmergency}
                  onClick={() => void handleEmergencySubmit()}
                >
                  {emergencySending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Siren className="h-4 w-4 mr-2" />}
                  {getUIText('orderHelp_emergencyConfirmSend', language)}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </>
        ) : null}
      </CardContent>
    </Card>
  )
}
