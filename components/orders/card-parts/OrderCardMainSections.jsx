'use client'

import { ProxiedImage } from '@/components/proxied-image'
import { Car, Home, Key, Mail, Phone, Star } from 'lucide-react'
import { getUIText } from '@/lib/translations'
import OrderTimeline from '@/components/orders/OrderTimeline'
import { OrderCardFinancials } from '@/components/orders/card-parts/OrderCardFinancials'
import { PartnerRenterTrustBadges } from '@/components/trust/PartnerRenterTrustBadges'
import { formatPayoutAfter } from '@/lib/orders/unified-order-card-model'

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
}) {
  return (
    <>
      <OrderTimeline
        status={status}
        type={normalizedOrder.type}
        language={language}
        reviewed={reviewed}
        checkOut={checkOut}
      />

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
              <p className="text-[11px] font-medium text-slate-600">{getUIText('orderCheckInPhotos_caption', language)}</p>
              <div className="grid grid-cols-3 gap-2">
                {checkInPhotoUrls.map((url, idx) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => onPhotoClick(idx)}
                    className="relative aspect-[4/3] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm outline-none ring-offset-2 transition hover:ring-2 hover:ring-teal-400 focus-visible:ring-2 focus-visible:ring-teal-500 cursor-zoom-in"
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
        <div className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">
          {getUIText('orderEscrow_guestProtected', language)}
        </div>
      ) : null}

      {normalizedRole === 'partner' && ['PAID_ESCROW', 'CHECKED_IN'].includes(status) ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          {getUIText('orderEscrow_partnerInEscrow', language).replace('{date}', formatPayoutAfter(checkOut, language))}
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
    </>
  )
}
