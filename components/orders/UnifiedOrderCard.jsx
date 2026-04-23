'use client'

import { useState } from 'react'
import Link from 'next/link'
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
  Star,
  X,
} from 'lucide-react'
import { formatPrice } from '@/lib/currency'
import { getUIText } from '@/lib/translations'
import OrderTypeIcon from '@/components/ui/OrderTypeIcon'
import OrderStatusBadge from '@/components/ui/order-status-badge'
import OrderTimeline from '@/components/orders/OrderTimeline'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
  const [disputeSubmitting, setDisputeSubmitting] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
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

  async function handleCreateDispute() {
    if (!bookingId) return
    setDisputeSubmitting(true)
    try {
      const res = await fetch('/api/v2/disputes/create', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          conversationId,
          reason: disputeReason.trim(),
          category: 'booking_dispute',
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        toast.error(json.error || getUIText('orderDispute_createError', language))
        return
      }
      if (json.alreadyExists) {
        toast.message(getUIText('orderDispute_alreadyExists', language))
      } else {
        toast.success(getUIText('orderDispute_created', language))
      }
      setHelpOpen(false)
      setDisputeReason('')
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
            <Button type="button" variant="outline" onClick={() => setHelpOpen(true)}>
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
        <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{getUIText('orderHelp_title', language)}</DialogTitle>
              <DialogDescription>{getUIText('orderHelp_description', language)}</DialogDescription>
            </DialogHeader>

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
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-900">{getUIText('orderHelp_level2Title', language)}</p>
              {disputeEligibility.allowed ? (
                <>
                  <p className="text-sm text-amber-800">{getUIText('orderHelp_level2Allowed', language)}</p>
                  <Textarea
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    placeholder={getUIText('orderDispute_reasonPlaceholder', language)}
                    maxLength={2000}
                    rows={4}
                  />
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
                  disabled={disputeSubmitting}
                >
                  {disputeSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {getUIText('orderHelp_openOfficialDispute', language)}
                </Button>
              ) : null}
            </DialogFooter>
          </DialogContent>
        </Dialog>
        ) : null}
      </CardContent>
    </Card>
  )
}
