/**
 * Stage 110.1 / 190.1 — SSOT гостевой цены на витрине (base + guest service fee %).
 * Каталог / поиск / SEO / избранное: `getGuestDisplayPerNight` (base + fee %).
 * PDP stay hero + breakdown total: `getGuestPayableTotalThb` / `getPdpHeroGuestPriceThb`
 * (= subtotal + service fee + tax, prefer `finalTotal`).
 * FX — `lib/pricing/fx-display.js` / `fx-display-client.js` (retail rateMap).
 * Не дублировать формулы оплаты из booking/checkout сервисов — только display.
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
 * Guest THB for map pin — same SSOT as catalog search card (base / _pricing + platform fee %).
 * @param {Record<string, unknown> | null | undefined} row
 * @param {number} [guestServiceFeePercent]
 */
export function getMapPinGuestDisplayThb(row, guestServiceFeePercent) {
  if (!row || typeof row !== 'object') return 0
  return getGuestDisplayPerNight({
    base_price_thb: row.base_price_thb,
    basePriceThb: row.base_price_thb,
    pricing: row._pricing || null,
    guestServiceFeePercent,
  })
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
 * Единица цены для min/max фильтра и гистограммы — совпадает с карточкой «за ночь».
 * При `dates` в URL поиска batch availability кладёт среднюю в `listing.pricing` / `_pricing`
 * (`averagePerNight`); `getGuestDisplayPerNight` учитывает это до голого `base_price_thb`.
 *
 * @param {Record<string, unknown> | null | undefined} listing
 * @param {{ checkIn?: string, checkOut?: string } | null | undefined} [dates]
 * @returns {number}
 */
export function getGuestDisplayForSearchFilters(listing, dates = null) {
  void dates
  return getGuestDisplayPerNight(listing)
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
 * Stage 190.1 — итого к оплате гостем из PDP `priceCalc` (display-only SSOT).
 * Предпочитает `finalTotal` (с rounding), иначе subtotal + service fee + tax.
 * @param {Record<string, unknown> | null | undefined} priceCalc
 * @returns {number}
 */
export function getGuestPayableTotalThb(priceCalc) {
  if (!priceCalc || typeof priceCalc !== 'object') return 0
  const final = Math.round(Number(priceCalc.finalTotal) || 0)
  if (final > 0) return final
  const subtotal = Math.round(
    Number(priceCalc.subtotalBeforeFee ?? priceCalc.totalPrice ?? priceCalc.subtotal) || 0,
  )
  const fee = Math.round(Number(priceCalc.serviceFee) || 0)
  const tax = Math.round(Number(priceCalc.taxAmountThb) || 0)
  return Math.max(0, subtotal + fee + tax)
}

/**
 * Разбор guest payable для hero / breakdown (без мутации priceCalc).
 * @param {Record<string, unknown> | null | undefined} priceCalc
 */
export function getGuestPayablePartsThb(priceCalc) {
  if (!priceCalc || typeof priceCalc !== 'object') {
    return {
      nights: 0,
      subtotalThb: 0,
      serviceFeeThb: 0,
      taxAmountThb: 0,
      unitThb: 0,
      amountThb: 0,
    }
  }
  const nights = Math.max(0, Math.round(Number(priceCalc.nights) || 0))
  const subtotalThb = Math.round(
    Number(priceCalc.subtotalBeforeFee ?? priceCalc.totalPrice ?? priceCalc.subtotal) || 0,
  )
  const serviceFeeThb = Math.round(Number(priceCalc.serviceFee) || 0)
  const taxAmountThb = Math.round(Number(priceCalc.taxAmountThb) || 0)
  const unitThb = nights > 0 ? Math.round(subtotalThb / nights) : 0
  return {
    nights,
    subtotalThb,
    serviceFeeThb,
    taxAmountThb,
    unitThb,
    amountThb: getGuestPayableTotalThb(priceCalc),
  }
}

/**
 * PDP hero: per night без дат; со stay — **итого к оплате** (= breakdown total).
 * @param {{ listing?: Record<string, unknown> | null, priceCalc?: Record<string, unknown> | null }} ctx
 */
export function getPdpHeroGuestPriceThb({ listing, priceCalc } = {}) {
  const parts = getGuestPayablePartsThb(priceCalc)
  if (priceCalc && parts.nights > 0 && parts.amountThb > 0) {
    return {
      amountThb: parts.amountThb,
      mode: 'stay',
      nights: parts.nights,
      subtotalThb: parts.subtotalThb,
      serviceFeeThb: parts.serviceFeeThb,
      taxAmountThb: parts.taxAmountThb,
      unitThb: parts.unitThb,
    }
  }
  return {
    amountThb: getGuestDisplayPerNight(listing),
    mode: 'perNight',
    nights: 0,
    subtotalThb: 0,
    serviceFeeThb: 0,
    taxAmountThb: 0,
    unitThb: 0,
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
