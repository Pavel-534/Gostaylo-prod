/**
 * Display helpers for partner booking list cards (Stage 185.0).
 */

import { buildGuestPriceBreakdownFromBooking } from '@/lib/booking/guest-price-breakdown'
import { getUIText } from '@/lib/translations'
import { COUNTRY_PRESETS } from '@/lib/geo/country-presets'
export { buildPartnerUnifiedOrder } from '@/lib/partner/partner-unified-order'

function dateLocaleForLanguage(language) {
  const lang = String(language || 'ru').toLowerCase()
  if (lang === 'en') return 'en-US'
  if (lang === 'th') return 'th-TH'
  if (lang === 'zh') return 'zh-CN'
  return 'ru-RU'
}

export function formatPartnerBookingDateRange(booking, language = 'ru') {
  const checkIn = booking?.checkIn || booking?.check_in
  const checkOut = booking?.checkOut || booking?.check_out
  if (!checkIn || !checkOut) return '—'
  const locale = dateLocaleForLanguage(language)
  const a = new Date(checkIn)
  const b = new Date(checkOut)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return '—'
  return `${a.toLocaleDateString(locale)} — ${b.toLocaleDateString(locale)}`
}

export function resolvePartnerBookingGuestName(booking, language = 'ru') {
  return (
    booking?.guestName ||
    [booking?.renter?.first_name, booking?.renter?.last_name].filter(Boolean).join(' ') ||
    [booking?.renter?.firstName, booking?.renter?.lastName].filter(Boolean).join(' ') ||
    getUIText('guest', language)
  )
}

export function resolvePartnerBookingListingTitle(booking, language = 'ru') {
  const listing = booking?.listing || booking?.listings || {}
  return listing?.title || getUIText('myBookings_listingFallback', language)
}

export function resolvePartnerBookingListingImage(booking) {
  const listing = booking?.listing || booking?.listings || {}
  return listing?.images?.[0] || listing?.coverImage || listing?.cover_image || null
}

export function resolvePartnerBookingDistrict(booking) {
  const listing = booking?.listing || booking?.listings || {}
  return listing?.district || null
}

/**
 * Stage 194.0-C — location line without hard-coded country.
 * Uses listing country / country_code + COUNTRY_PRESETS; falls back to i18n Thailand only when code is TH/empty (legacy Phuket data).
 */
export function resolvePartnerBookingLocationLine(booking, language = 'ru') {
  const listing = booking?.listing || booking?.listings || {}
  const district = listing?.district || null
  if (!district) return null

  const code = String(
    listing?.country_code || listing?.countryCode || listing?.country || '',
  )
    .trim()
    .toUpperCase()

  let countryLabel = null
  if (code.length === 2) {
    const preset = COUNTRY_PRESETS.find((c) => c.code === code)
    countryLabel = preset?.labels?.[language] || preset?.labels?.en || null
  } else if (code.length > 2) {
    countryLabel = code
  }

  if (!countryLabel) {
    // No country on listing — show district only (avoid hard-coded «Thailand»).
    return district
  }

  return `${district}, ${countryLabel}`
}

/** SSOT partner net / guest paid — shared with OrderCardFinancialTotals. */
export function resolvePartnerOrderFooterAmounts(booking, partnerEarnings) {
  const snap = booking?.financial_snapshot
  let guestPaid = null
  if (snap && typeof snap === 'object') {
    const gp = Number(snap.guestPayableThb)
    if (Number.isFinite(gp) && gp > 0) guestPaid = gp
  }
  if (guestPaid == null) {
    const breakdown = buildGuestPriceBreakdownFromBooking(booking)
    if (breakdown.hasDetail && breakdown.totalThb > 0) guestPaid = breakdown.totalThb
  }
  if (guestPaid == null) {
    const paid = Number(booking?.price_paid ?? booking?.pricePaid)
    const thb = Number(booking?.price_thb ?? booking?.priceThb)
    const fallback = Number.isFinite(paid) && paid > 0 ? paid : thb
    if (Number.isFinite(fallback) && fallback > 0) guestPaid = fallback
  }

  let net = Number(partnerEarnings)
  if (!Number.isFinite(net) && snap && typeof snap === 'object') {
    net = Number(snap.partnerPayoutThb ?? snap.net ?? snap.partner_earnings_thb)
  }
  if (!Number.isFinite(net)) {
    net = Number(booking?.partner_earnings_thb ?? booking?.partnerEarningsThb)
  }

  return {
    guestPaid: Number.isFinite(guestPaid) && guestPaid > 0 ? guestPaid : null,
    netEarnings: Number.isFinite(net) && net > 0 ? net : null,
  }
}
