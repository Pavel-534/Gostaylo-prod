/**
 * Stage 110.4 — client-safe FX display (без currency.service / Supabase).
 * Серверные rateMap — через API или SSR; форматирование — здесь.
 *
 * @see lib/pricing/fx-display.js — storefront/mid rateMap на сервере
 */

import { formatPrice, getCurrencySymbol, priceRawForTest } from '@/lib/currency'
import { convertAmountThbWithMap } from '@/lib/finance/currency-converter-shared'
import { normalizeThbPerUnitRate } from '@/lib/finance/thb-per-unit-rate.js'
import { differenceInDays } from 'date-fns'
import {
  computeGuestDisplayFromBaseThb,
  getGuestDisplayForStay,
  getGuestDisplayPerNight,
  getPdpHeroGuestPriceThb,
} from '@/lib/pricing/guest-display-price'
import { getGuestPayableRoundedThb } from '@/lib/booking-guest-total'

export function convertThbToDisplayCurrency(amountThb, targetCurrency, rateMap) {
  return convertAmountThbWithMap(amountThb, targetCurrency, rateMap)
}

/** Округление суммы в валюте счёта / UI (как formatPrice). */
export function roundAmountInCurrency(amount, currencyCode) {
  const code = String(currencyCode || 'THB').toUpperCase()
  const n = Number(amount)
  if (!Number.isFinite(n)) return 0
  if (code === 'USD' || code === 'USDT') return Math.round(n * 100) / 100
  return Math.round(n)
}

/**
 * Сумма в валюте счёта → THB по retail rateMap (витрина).
 * `rateMap[c]` = THB за 1 единицу валюты.
 */
export function convertDisplayAmountToThb(amount, currencyCode, rateMap) {
  const code = String(currencyCode || 'THB').toUpperCase()
  const a = Number(amount)
  if (!Number.isFinite(a) || a <= 0) return 0
  if (code === 'THB') return Math.round(a)
  const rates = rateMap && typeof rateMap === 'object' ? { THB: 1, ...rateMap } : { THB: 1 }
  const rate = normalizeThbPerUnitRate(code, Number(rates[code]))
  if (rate == null || rate <= 0) return 0
  return Math.round(a * rate)
}

/** THB → валюта по retail map с тем же округлением, что на витрине. */
export function convertThbToDisplayAmountRounded(amountThb, currencyCode, rateMap) {
  const converted = convertThbToDisplayCurrency(amountThb, currencyCode, rateMap)
  if (!Number.isFinite(converted)) return null
  return roundAmountInCurrency(converted, currencyCode)
}

/** USDT-эквивалент из THB (retail `rateMap.USDT`). */
export function computeUsdtFromThbRetail(amountThb, rateMap) {
  const thb = Number(amountThb)
  if (!Number.isFinite(thb) || thb <= 0) return 0
  const r = Number(rateMap?.USDT)
  if (!Number.isFinite(r) || r <= 0) return 0
  return Math.round((thb / r) * 100) / 100
}

/**
 * Презентация суммы инвойса для гостя: канон — валюта счёта; при другой UI-валюте — retail-эквивалент из `amount_thb`.
 */
export function getInvoiceGuestAmountPresentation({
  invoice,
  guestUiCurrency,
  rateMap,
  language = 'en',
}) {
  const invCur = String(invoice?.currency || 'THB').toUpperCase()
  const amount = Number(invoice?.amount ?? 0)
  const amountThb = Number(invoice?.amount_thb ?? 0)
  const sym = getCurrencySymbol(invCur)
  const primary = {
    currency: invCur,
    amount,
    label: `${sym}${amount.toLocaleString()} ${invCur}`,
  }

  const guestCur = String(guestUiCurrency || invCur).toUpperCase()
  if (!amountThb || guestCur === invCur) {
    return { primary, secondary: null }
  }

  const rates = rateMap && typeof rateMap === 'object' ? { THB: 1, ...rateMap } : { THB: 1 }
  const secondaryFormatted = formatDisplayPriceInCurrency(amountThb, guestCur, rates, language)
  const secondaryAmount = convertThbToDisplayAmountRounded(amountThb, guestCur, rates)

  return {
    primary,
    secondary: secondaryFormatted
      ? { currency: guestCur, amount: secondaryAmount, label: `≈ ${secondaryFormatted}` }
      : null,
  }
}

export function formatDisplayPriceInCurrency(amountThb, targetCurrency, rateMap, language = 'en') {
  const code = String(targetCurrency || 'THB').toUpperCase()
  const rates = rateMap && typeof rateMap === 'object' ? { THB: 1, ...rateMap } : { THB: 1 }
  return formatPrice(amountThb, code, rates, language)
}

export function displayPriceRawForTest(amountThb, targetCurrency, rateMap) {
  return priceRawForTest(amountThb, targetCurrency, rateMap)
}

export function getListingGuestDisplayThb(listing, opts = {}) {
  const nights = Math.round(Number(opts.nights) || 0)
  if (opts.priceCalc && nights > 0) {
    return getPdpHeroGuestPriceThb({ listing, priceCalc: opts.priceCalc }).amountThb
  }
  if (nights > 0) {
    return getGuestDisplayForStay(listing, nights, opts.guestServiceFeePercent)
  }
  return getGuestDisplayPerNight(listing, opts.guestServiceFeePercent)
}

export function getDisplayPriceInCurrency(listing, targetCurrency, options = {}) {
  const currency = String(targetCurrency || 'THB').toUpperCase()
  const language = options.language || 'en'
  const amountThb = getListingGuestDisplayThb(listing, {
    nights: options.nights,
    priceCalc: options.priceCalc,
    guestServiceFeePercent: options.guestServiceFeePercent,
  })
  const rateMap =
    options.exchangeRates && typeof options.exchangeRates === 'object'
      ? { THB: 1, ...options.exchangeRates }
      : { THB: 1 }

  const amountInCurrency =
    currency === 'THB' ? amountThb : convertThbToDisplayCurrency(amountThb, currency, rateMap)

  const formatted = formatDisplayPriceInCurrency(amountThb, currency, rateMap, language)

  return {
    amountThb,
    formatted,
    amountInCurrency: Number.isFinite(amountInCurrency) ? amountInCurrency : null,
    currency,
  }
}

/**
 * SSOT префилла суммы инвойса партнёром: гостевая цена витрины → валюта счёта (retail FX).
 * Партнёр может изменить значение вручную после префилла.
 */
export function resolveInvoicePrefillFromStorefront({
  booking = null,
  listing = null,
  currency = 'THB',
  rateMap = null,
  guestServiceFeePercent,
}) {
  const cur = String(currency || 'THB').toUpperCase()
  const rates = rateMap && typeof rateMap === 'object' ? { THB: 1, ...rateMap } : { THB: 1 }

  let guestThb = 0
  const listingForPrice =
    listing && typeof listing === 'object'
      ? listing
      : booking?.listings && typeof booking.listings === 'object'
        ? booking.listings
        : null

  if (booking && typeof booking === 'object') {
    guestThb = Math.round(Number(getGuestPayableRoundedThb(booking)) || 0)
  }

  if (guestThb <= 0 && listingForPrice) {
    let nights = 0
    const checkIn = booking?.check_in ?? booking?.checkIn
    const checkOut = booking?.check_out ?? booking?.checkOut
    if (checkIn && checkOut) {
      try {
        nights = Math.max(1, differenceInDays(new Date(checkOut), new Date(checkIn)))
      } catch {
        nights = 0
      }
    }
    guestThb =
      nights > 0
        ? getGuestDisplayForStay(listingForPrice, nights, guestServiceFeePercent)
        : getGuestDisplayPerNight(listingForPrice, guestServiceFeePercent)
  }

  guestThb = Math.max(0, Math.round(guestThb))
  if (guestThb <= 0) {
    return { guestThb: 0, amount: '', currency: cur }
  }

  const amount =
    cur === 'THB'
      ? guestThb
      : convertThbToDisplayAmountRounded(guestThb, cur, rates) ?? guestThb

  return {
    guestThb,
    amount: amount > 0 ? String(amount) : '',
    currency: cur,
  }
}

export function computeWizardStorefrontPricePreview(basePriceThb, pricingPolicy, ctx = {}) {
  const base = Math.round(Number(basePriceThb) || 0)
  const guestFeePercent = Number(pricingPolicy?.guestServiceFeePercent) || 0
  const guestFeeThb = Math.round(base * (guestFeePercent / 100))
  const storefrontGuestDisplayThb = computeGuestDisplayFromBaseThb(base, guestFeePercent)

  const listingCurrency = String(ctx.listingBaseCurrency || 'THB').toUpperCase()
  const rates =
    ctx.exchangeRates && typeof ctx.exchangeRates === 'object'
      ? { THB: 1, ...ctx.exchangeRates }
      : null

  let storefrontInListingCurrency = storefrontGuestDisplayThb
  if (listingCurrency !== 'THB' && rates) {
    const converted = convertThbToDisplayCurrency(
      storefrontGuestDisplayThb,
      listingCurrency,
      rates,
    )
    if (Number.isFinite(converted)) {
      storefrontInListingCurrency = Math.round(converted)
    }
  }

  const retailMultiplier = Math.max(1, Number(pricingPolicy?.chatInvoiceRateMultiplier) || 1)
  const chatInvoiceReferenceThb = Math.round(storefrontGuestDisplayThb * retailMultiplier)

  return {
    base,
    guestFeePercent,
    guestFeeThb,
    storefrontGuestDisplayThb,
    sitePriceSameCurrency: storefrontGuestDisplayThb,
    storefrontInListingCurrency,
    listingBaseCurrency: listingCurrency,
    retailMarkupMultiplier: retailMultiplier,
    chatInvoiceReferenceThb,
    sitePriceCrossCurrency: chatInvoiceReferenceThb,
    markupPercent: Math.max(0, (retailMultiplier - 1) * 100),
  }
}
