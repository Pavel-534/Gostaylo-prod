'use client'

import { ProxiedImage } from '@/components/proxied-image'
import { Car, Home, Key, Mail, Phone, Star } from 'lucide-react'
import { getUIText } from '@/lib/translations'
import OrderTimeline from '@/components/orders/OrderTimeline'
import { OrderCardFinancials } from '@/components/orders/card-parts/OrderCardFinancials'
import { PartnerRenterTrustBadges } from '@/components/trust/PartnerRenterTrustBadges'
import { resolvePartnerEscrowCallout } from '@/lib/orders/unified-order-card-model'
import { GuestBookingNextStepsCard } from '@/components/guest/GuestBookingNextStepsCard'
import { HostBookingNextStepsCard } from '@/components/partner/HostBookingNextStepsCard'
import { HostMoneyTimelineChip } from '@/components/partner/HostMoneyTimelineChip'
import { isBookingPayable } from '@/lib/booking/booking-status-rules'

/** Timeline, trust, pricing block, check-in media, admin parties, escrow callouts, partner guest card. */
export function OrderCardMainSections({
  language,
  normalizedRole,
  booking,
  normalizedOrder,
  status,
  checkOut,
  reviewed,
  partnerTrustPublic,
  partnerFinanceOpen,
  setPartnerFinanceOpen,
  title,
  bookingId,
  pickupServiceKind,
  checkInInstructionsText,
  checkInPhotoUrls,
  onPhotoClick,
  listingImage,
  guestName,
  guestPhone,
  guestEmail,
  supportChatHref = null,
  listingCategorySlug = null,
  wizardProfile = null,
}) {
  const partnerEscrowCallout =
    normalizedRole === 'partner' ? resolvePartnerEscrowCallout(booking, status, language) : null
  const partnerCalloutToneClass =
    partnerEscrowCallout?.tone === 'sky'
      ? 'border-sky-200 bg-sky-50 text-sky-900'
      : partnerEscrowCallout?.tone === 'indigo'
        ? 'border-indigo-200 bg-indigo-50 text-indigo-900'
        : partnerEscrowCallout?.tone === 'emerald'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : 'border-blue-200 bg-blue-50 text-blue-900'

  return (
    <>
      {normalizedRole === 'renter' &&
      ['PENDING', 'INQUIRY', 'AWAITING_PAYMENT', 'PAID_ESCROW'].includes(String(status || '').toUpperCase()) ? (
        <GuestBookingNextStepsCard
          status={status}
          bookingId={bookingId}
          language={language}
          categorySlug={listingCategorySlug}
          wizardProfile={wizardProfile}
          chatHref={supportChatHref}
          payHref={
            isBookingPayable(String(status || '').toUpperCase()) && bookingId
              ? `/checkout/${encodeURIComponent(String(bookingId))}`
              : null
          }
          surface="my_bookings"
        />
      ) : null}
      {normalizedRole === 'partner' && bookingId ? (
        <HostBookingNextStepsCard
          booking={booking}
          bookingId={bookingId}
          status={status}
          language={language}
          surface="my_bookings"
        />
      ) : null}

      <OrderTimeline
        status={status}
        type={normalizedOrder.type}
        language={language}
        reviewed={reviewed}
        checkOut={checkOut}
      />
      {normalizedRole === 'partner' ? (
        <HostMoneyTimelineChip status={status} language={language} bookingContext={booking} />
      ) : null}

      {normalizedRole === 'renter' && partnerTrustPublic ? (
        <PartnerRenterTrustBadges trust={partnerTrustPublic} language={language} />
      ) : null}

      <OrderCardFinancials
        booking={booking}
        language={language}
        normalizedRole={normalizedRole}
        partnerFinanceOpen={partnerFinanceOpen}
        setPartnerFinanceOpen={setPartnerFinanceOpen}
        title={title}
        bookingId={bookingId}
        status={status}
      />

      {normalizedRole === 'renter' && (checkInInstructionsText || checkInPhotoUrls.length > 0) ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 flex items-center gap-2">
            {pickupServiceKind === 'transport' ? (
              <Car className="h-4 w-4 text-slate-500 shrink-0" aria-hidden />
            ) : (
              <Key className="h-4 w-4 text-slate-500 shrink-0" aria-hidden />
            )}
            {getUIText('orderCheckInInstructions_title', language)}
          </p>
          {checkInInstructionsText ? (
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{checkInInstructionsText}</p>
          ) : null}
          {checkInPhotoUrls.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-slate-600">
                {getUIText('orderCheckInPhotos_caption', language, {
                  listingCategorySlug: listingCategorySlug || undefined,
                  wizardProfile,
                })}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {checkInPhotoUrls.map((url, idx) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => onPhotoClick(idx)}
                    className="relative aspect-[4/3] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm outline-none ring-offset-2 transition hover:ring-2 hover:ring-brand/40 focus-visible:ring-2 focus-visible:ring-brand cursor-zoom-in"
                    aria-label={getUIText('orderCheckInPhotos_openLightbox', language)}
                  >
                    <ProxiedImage src={url} alt="" fill className="object-cover" sizes="120px" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

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
        <div className="rounded-xl border border-brand/25 bg-brand/10 px-3 py-2 text-sm text-brand">
          {getUIText('orderEscrow_guestProtected', language)}
        </div>
      ) : null}

      {partnerEscrowCallout ? (
        <div className={`rounded-xl border px-3 py-2 text-sm ${partnerCalloutToneClass}`}>
          {partnerEscrowCallout.message}
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
    </>
  )
}
