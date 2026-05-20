/**
 * Stage 107.1–107.2 — SSOT гостевой цены на витрине (base + guest service fee %).
 * Каталог, карта, PDP hero — одна формула; налоги только в breakdown бронирования.
 */

import { PLATFORM_SPLIT_FEE_DEFAULTS } from '@/lib/config/platform-split-fee-defaults.js'
import { formatRentalSpanLabel } from '@/lib/rental-period-labels'

/**
 * @param {number | null | undefined} pct
 */
export function normalizeGuestServiceFeePercent(pct) {
  const n = Number(pct)
  if (Number.isFinite(n) && n >= 0 && n <= 100) return n
  return PLATFORM_SPLIT_FEE_DEFAULTS.guestServiceFeePercent
}

/**
 * @param {number} basePriceThb
 * @param {number} [guestServiceFeePercent]
 */
export function computeGuestDisplayFromBaseThb(basePriceThb, guestServiceFeePercent) {
  const base = Math.round(Math.max(0, Number(basePriceThb) || 0))
  if (base <= 0) return 0
  const guestPct = normalizeGuestServiceFeePercent(guestServiceFeePercent)
  const guestFeeThb = Math.round(base * (guestPct / 100))
  return base + guestFeeThb
}

/**
 * % сервисного сбора с листинга (API) или явный аргумент.
 * @param {Record<string, unknown> | null | undefined} listing
 * @param {number} [guestServiceFeePercent]
 */
export function resolveGuestServiceFeePercent(listing, guestServiceFeePercent) {
  if (guestServiceFeePercent != null && guestServiceFeePercent !== '') {
    return normalizeGuestServiceFeePercent(guestServiceFeePercent)
  }
  const fromListing =
    listing?.guestServiceFeePercent ?? listing?.guest_service_fee_percent
  if (fromListing != null && fromListing !== '') {
    return normalizeGuestServiceFeePercent(fromListing)
  }
  return PLATFORM_SPLIT_FEE_DEFAULTS.guestServiceFeePercent
}

/**
 * Гостевая цена за ночь/сутки (витрина).
 * @param {Record<string, unknown> | null | undefined} listing
 * @param {number} [guestServiceFeePercent]
 */
export function getGuestDisplayPerNight(listing, guestServiceFeePercent) {
  if (!listing || typeof listing !== 'object') return 0

  const fromApi = listing.guestDisplayPriceThb ?? listing.guest_display_price_thb
  const parsedApi = Number(fromApi)
  if (Number.isFinite(parsedApi) && parsedApi > 0) return Math.round(parsedApi)

  const pct = resolveGuestServiceFeePercent(listing, guestServiceFeePercent)
  const pr = listing.pricing ?? listing._pricing
  const avg = Number(pr?.averagePerNight ?? pr?.average_per_night)
  if (Number.isFinite(avg) && avg > 0) {
    return computeGuestDisplayFromBaseThb(avg, pct)
  }

  const base = Math.round(
    parseFloat(listing.basePriceThb ?? listing.base_price_thb ?? 0) || 0,
  )
  if (base <= 0) return 0
  return computeGuestDisplayFromBaseThb(base, pct)
}

/**
 * Гостевая цена за выбранный период (календарный субтотал + fee %).
 * @param {Record<string, unknown> | null | undefined} listing
 * @param {number} nights
 * @param {number} [guestServiceFeePercent]
 */
export function getGuestDisplayForStay(listing, nights, guestServiceFeePercent) {
  const n = Math.max(1, Math.round(Number(nights) || 0))
  if (!listing || typeof listing !== 'object') return 0

  const pct = resolveGuestServiceFeePercent(listing, guestServiceFeePercent)
  const pr = listing.pricing ?? listing._pricing
  const total = Number(pr?.totalPrice ?? pr?.total_price)
  if (Number.isFinite(total) && total > 0) {
    return computeGuestDisplayFromBaseThb(total, pct)
  }

  return getGuestDisplayPerNight(listing, pct) * n
}

/**
 * PDP hero: per night без дат, total за период с priceCalc.
 * @param {{ listing?: Record<string, unknown> | null, priceCalc?: Record<string, unknown> | null }} ctx
 */
export function getPdpHeroGuestPriceThb({ listing, priceCalc } = {}) {
  const nights = Math.round(Number(priceCalc?.nights) || 0)
  if (priceCalc && nights > 0) {
    const subtotal = Math.round(
      Number(priceCalc.subtotalBeforeFee ?? priceCalc.totalPrice ?? priceCalc.subtotal) || 0,
    )
    const fee = Math.round(Number(priceCalc.serviceFee) || 0)
    return { amountThb: subtotal + fee, mode: 'stay', nights }
  }
  return {
    amountThb: getGuestDisplayPerNight(listing),
    mode: 'perNight',
    nights: 0,
  }
}

/** @deprecated use computeGuestDisplayFromBaseThb */
export const computeCatalogGuestDisplayPriceThb = computeGuestDisplayFromBaseThb

/** @deprecated use getGuestDisplayPerNight */
export const resolveListingGuestDisplayPriceThb = getGuestDisplayPerNight

/**
 * Подпись периода для карточки каталога: «/ ночь» или «за N ночей».
 * @param {{ nights: number, spanMode: 'night'|'day', language: string }} opts
 */
export function formatCardPricePeriodSuffix({ nights, spanMode, language }) {
  const n = Math.max(0, Math.floor(Number(nights) || 0))
  if (n > 0) {
    const span = formatRentalSpanLabel(n, spanMode, language)
    if (language === 'ru') return `за ${span}`
    if (language === 'zh') return span
    if (language === 'th') return span
    return `for ${span}`
  }
  const dayUnit = spanMode === 'day'
  if (language === 'ru') return `/ ${dayUnit ? 'сутки' : 'ночь'}`
  if (language === 'zh') return `/ ${dayUnit ? '天' : '晚'}`
  if (language === 'th') return `/ ${dayUnit ? 'วัน' : 'คืน'}`
  return `/ ${dayUnit ? 'day' : 'night'}`
}

export const BOOKING_PRICE_BREAKDOWN_ID = 'booking-price-breakdown'

/** Прокрутка к блоку детального расчёта на PDP. */
export function scrollToBookingPriceBreakdown() {
  if (typeof document === 'undefined') return
  document.getElementById(BOOKING_PRICE_BREAKDOWN_ID)?.scrollIntoView({
    behavior: 'smooth',
    block: 'nearest',
  })
}
