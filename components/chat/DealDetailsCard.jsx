'use client'

/**
 * Правая панель «сделка» (Airbnb-style): превью листинга, даты, сумма/статус, ссылка на объявление.
 * Stage 146 — role-aware financial context (guest total + escrow / host net earnings).
 */

import Link from 'next/link'
import { format } from 'date-fns'
import { ru as ruLocale } from 'date-fns/locale'
import { Building2, CalendarRange, Banknote, ExternalLink, Shield } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { resolveImageThumbDisplayUrl } from '@/lib/image-display-url'
import { getUIText } from '@/lib/translations'
import { getHostMoneyStage } from '@/lib/booking/host-money-stage.js'
import { readGuestPaymentDisplay } from '@/lib/booking/guest-payment-display.js'
import DisputeStatusWidget from '@/components/orders/DisputeStatusWidget.jsx'
import { getGuestDateLabel } from '@/lib/i18n/guest-booking-labels'

/** Guest escrow badge — only while funds are actively held (not after thaw/payout). */
const GUEST_ESCROW_BADGE_STATUSES = new Set(['PAID_ESCROW', 'PAID', 'CHECKED_IN'])

function fmtDate(iso, language) {
  if (!iso) return null
  try {
    return format(new Date(iso), 'd MMM yyyy', { locale: language !== 'en' ? ruLocale : undefined })
  } catch {
    return null
  }
}

function resolveDisputeSnapshot(booking) {
  return booking?.dispute_snapshot || booking?.disputeSnapshot || null
}

function statusLabel(status, language) {
  const s = String(status || '').toUpperCase()
  const key = `chatBookingStatus_${s}`
  const translated = getUIText(key, language)
  if (translated !== key) return translated
  return status || '—'
}

function resolveFinancialLines({ booking, isHosting, language }) {
  const snap =
    booking?.financial_snapshot && typeof booking.financial_snapshot === 'object'
      ? booking.financial_snapshot
      : null

  const guestTotal =
    snap?.guest_total_thb ??
    booking?.total_price_thb ??
    booking?.totalPriceThb ??
    booking?.price_thb ??
    booking?.priceThb ??
    null

  const partnerEarnings =
    snap?.partner_earnings_thb ??
    booking?.partner_earnings_thb ??
    booking?.partnerEarningsThb ??
    null

  const commissionThb = snap?.commission_thb ?? booking?.commission_thb ?? null
  const commissionRate = snap?.commission_rate ?? booking?.commission_rate ?? null

  if (isHosting) {
    const earnings = partnerEarnings ?? guestTotal
    return {
      amountLabel: getUIText('dealCard_hostEarnings', language),
      amountLine:
        earnings != null && earnings !== ''
          ? `${Number(earnings).toLocaleString()} THB`
          : '—',
      commissionLine:
        commissionThb != null && commissionRate != null
          ? getUIText('dealCard_commissionLine', language)
              .replace('{{amount}}', Number(commissionThb).toLocaleString())
              .replace('{{rate}}', String(commissionRate))
          : null,
      showEscrow: false,
    }
  }

  return {
    amountLabel: getUIText('dealCard_guestTotal', language),
    amountLine: readGuestPaymentDisplay(booking, { language })?.displayAmount ?? '—',
    commissionLine: null,
    showEscrow: GUEST_ESCROW_BADGE_STATUSES.has(String(booking?.status || '').toUpperCase()),
  }
}

/**
 * @param {Object} props
 * @param {Object|null} [props.listing]
 * @param {Object|null} [props.booking]
 * @param {string} [props.language]
 * @param {boolean} [props.isHosting]
 * @param {string} [props.className]
 * @param {Function} [props.onOpenCalendar]
 */
export function DealDetailsCard({
  listing = null,
  booking = null,
  language = 'ru',
  isHosting = false,
  className,
  onOpenCalendar,
}) {
  const title = listing?.title || getUIText('dealCard_listingFallback', language) || 'Listing'
  const imgRaw = listing?.images?.[0]
  const img = imgRaw ? resolveImageThumbDisplayUrl(imgRaw) || imgRaw : null

  const checkIn = booking?.check_in || booking?.checkIn
  const checkOut = booking?.check_out || booking?.checkOut
  const status = booking?.status
  const categorySlug =
    listing?.category_slug ||
    listing?.categorySlug ||
    booking?.category_slug ||
    booking?.listings?.category_slug ||
    null
  const wizardProfile = listing?.wizard_profile || listing?.wizardProfile || null
  const dateLabelCtx = { categorySlug, wizardProfile, language }
  const checkInLabel = getGuestDateLabel('checkInLabel', dateLabelCtx)
  const checkOutLabel = getGuestDateLabel('checkOutLabel', dateLabelCtx)

  const financial = resolveFinancialLines({ booking, isHosting, language })
  const hostMoney =
    isHosting && status
      ? getHostMoneyStage(status, language, { ...booking, listing })
      : null
  const disputeSnapshot = resolveDisputeSnapshot(booking)
  const showDisputeWidget = Boolean(disputeSnapshot?.id && disputeSnapshot?.isActive)

  return (
    <div className={cn('flex flex-col gap-4 p-4 lg:p-5', className)}>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
          {getUIText('dealCard_tripDetails', language) || (language === 'en' ? 'Trip details' : 'Детали поездки')}
        </h3>

        <Card className="overflow-hidden rounded-2xl border-slate-200 shadow-sm">
          <div className="flex gap-3 p-3 bg-white">
            <div className="h-16 w-16 shrink-0 rounded-2xl overflow-hidden bg-slate-100 border border-slate-100">
              {img ? (
                <img src={img} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <Building2 className="h-7 w-7 text-slate-300" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900 text-sm leading-snug line-clamp-2">{title}</p>
              {listing?.district ? (
                <p className="text-xs text-slate-500 mt-0.5 truncate">{listing.district}</p>
              ) : null}
            </div>
          </div>
        </Card>
      </div>

      {booking?.id ? (
        <>
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm">
              <CalendarRange className="h-4 w-4 text-brand shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                  {checkInLabel}
                </p>
                <p className="text-slate-900 font-medium">{fmtDate(checkIn, language) || '—'}</p>
              </div>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <CalendarRange className="h-4 w-4 text-brand shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                  {checkOutLabel}
                </p>
                <p className="text-slate-900 font-medium">{fmtDate(checkOut, language) || '—'}</p>
              </div>
            </div>
          </div>

          <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">
                  {getUIText('dealCard_status', language) || (language === 'en' ? 'Status' : 'Статус')}
                </span>
                <span className="text-xs font-semibold rounded-full bg-slate-100 text-slate-800 px-2 py-0.5">
                  {statusLabel(status, language)}
                </span>
              </div>
              <div className="flex items-start gap-2 pt-1 border-t border-slate-100">
                <Banknote className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-slate-500">{financial.amountLabel}</p>
                  <p className="text-sm font-semibold text-slate-900">{financial.amountLine}</p>
                  {financial.commissionLine ? (
                    <p className="text-[11px] text-slate-500 mt-1">{financial.commissionLine}</p>
                  ) : null}
                  {hostMoney ? (
                    <p className="text-[11px] text-brand mt-1.5 leading-snug">
                      {getUIText('dealCard_hostMoneyHint', language)
                        .replace('{{title}}', hostMoney.title)
                        .replace('{{eta}}', hostMoney.eta)}
                    </p>
                  ) : null}
                </div>
              </div>
              {financial.showEscrow ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 rounded-lg border border-brand/20 bg-brand/10 px-2 py-1.5 text-[11px] font-medium text-brand">
                    <Shield className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {getUIText('dealCard_escrowProtected', language)}
                  </div>
                  {!isHosting ? (
                    <p className="text-[11px] text-slate-600 leading-snug px-0.5">
                      {getUIText('dealCard_guestEscrowHint', language)}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {showDisputeWidget ? (
            <DisputeStatusWidget
              dispute={disputeSnapshot}
              language={language}
              hideChatLink
              compact
              isHosting={isHosting}
            />
          ) : null}
        </>
      ) : (
        <p className="text-sm text-slate-500 leading-relaxed">
          {getUIText('dealCard_noBooking', language) ||
            (language === 'en'
              ? 'No booking linked to this chat yet. Continue the conversation to request dates.'
              : 'К этому чату пока не привязано бронирование. Продолжите переписку, чтобы согласовать даты.')}
        </p>
      )}

      {typeof onOpenCalendar === 'function' ? (
        <Button
          type="button"
          variant="outline"
          className="w-full justify-center gap-2 border-brand/25 bg-brand/10 text-brand hover:bg-brand/15 font-medium shadow-sm"
          onClick={onOpenCalendar}
        >
          <CalendarRange className="h-4 w-4 shrink-0" aria-hidden />
          {getUIText('dealCard_calendar', language) ||
            (language === 'en' ? 'Availability calendar' : 'Календарь занятости')}
        </Button>
      ) : null}

      {listing?.id ? (
        <Button
          asChild
          variant="outline"
          className="w-full justify-center gap-2 border-slate-200 text-slate-800 hover:bg-slate-50"
        >
          <Link href={`/listings/${listing.id}`}>
            <ExternalLink className="h-4 w-4 shrink-0" />
            {getUIText('dealCard_viewListing', language) ||
              (language === 'en' ? 'View listing' : 'Перейти к объявлению')}
          </Link>
        </Button>
      ) : null}
    </div>
  )
}
