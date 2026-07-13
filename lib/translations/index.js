/**
 * i18n — merged UI strings + helpers.
 * Slices: common, listings (public + partner), errors, ui (dashboard / renter / partner chrome).
 */

import { categoryTranslations, amenityTranslations } from './categories'
import { uiTranslations } from './translation-state'
import { resolveVerticalOverrideRawKey } from './vertical-context'
import { getGuestBookingLabelPlaceholders } from '@/lib/i18n/guest-booking-labels'
import { SUPPORTED_UI_LANGUAGES, DEFAULT_UI_LOCALE } from '@/lib/i18n/locale-resolver'
import { getSiteDisplayName } from '@/lib/site-url'

/** Канонический fallback UI / SSR (совпадает с I18nProvider и `getLangFromRequest`). */
export const DEFAULT_UI_LANGUAGE = DEFAULT_UI_LOCALE

const LANG_COOKIE_NAME = 'gostaylo_language'
const LANG_COOKIE_MAX_AGE = 60 * 60 * 24 * 400

/** @deprecated Use `import { uiTranslations } from '@/lib/translations/translation-state'` */
export { uiTranslations }

/** SSOT списка языков — `lib/i18n/locale-resolver.js` (Stage 42.1). */
export const supportedLanguages = SUPPORTED_UI_LANGUAGES

export { categoryTranslations, amenityTranslations }
export { HELICOPTER_CATEGORY_SLUGS, resolveVerticalOverrideRawKey } from './vertical-context'

/** Stage 109.1 — topic slices (merged exports preserve legacy `listingsPartnerUi` / `profileAppUi`). */
export { listingsPartnerUi } from './listings-partner'
export { listingsPartnerCoreUi } from './listings-partner-core'
export { listingsPartnerWizardUi } from './listings-partner-wizard'
export { listingsPartnerFinancesUi } from './listings-partner-finances'
export { listingsPartnerCalendarUi } from './listings-partner-calendar'
export { profileAppUi } from './slices/profile-app'
export { productUiStrings } from './slices/product-ui'
export { profileAppCoreUi } from './slices/profile-app-core'
export { profileAppPartnerUi } from './slices/profile-app-partner'
export { profileAppRenterUi } from './slices/profile-app-renter'
export { profileAppReferralUi } from './slices/profile-app-referral'
export { partnerUiStrings } from './slices/partner-ui'

export function getCategoryName(slug, lang = DEFAULT_UI_LANGUAGE, fallback = '') {
  const translations = categoryTranslations[slug?.toLowerCase()]
  if (translations && translations[lang]) {
    return translations[lang]
  }
  return fallback || slug
}

export function getAmenityName(slug, lang = DEFAULT_UI_LANGUAGE, fallback = '') {
  const key = slug?.toLowerCase()
  const translations = amenityTranslations[key] || amenityTranslations[key?.replace(/\s+/g, ' ')]
  if (translations && translations[lang]) {
    return translations[lang]
  }
  return fallback || slug
}

/** Подстановка белого лейбла в UI-строках (плейсхолдер `{brand}`). */
function injectBrand(str) {
  if (typeof str !== 'string') return str
  return str.replace(/\{brand\}/g, getSiteDisplayName())
}

/** Плейсхолдеры из `ctx` (например `{welcomeThb}`, `{welcomeApprox}` для маркетинговых экранов). */
function applyCtxStringPlaceholders(str, ctx) {
  if (typeof str !== 'string' || !ctx || typeof ctx !== 'object') return str
  let out = str
  if (ctx.welcomeThb != null && String(ctx.welcomeThb).length) {
    out = out.replace(/\{welcomeThb\}/g, String(ctx.welcomeThb))
  }
  if (ctx.welcomeApprox != null) {
    out = out.replace(/\{welcomeApprox\}/g, String(ctx.welcomeApprox))
  } else {
    out = out.replace(/\{welcomeApprox\}/g, '')
  }
  if (ctx.welcomeRub != null && String(ctx.welcomeRub).length) {
    out = out.replace(/\{welcomeRub\}/g, String(ctx.welcomeRub))
  }
  if (ctx.welcomeAmount != null && String(ctx.welcomeAmount).length) {
    out = out.replace(/\{welcomeAmount\}/g, String(ctx.welcomeAmount))
  }
  if (ctx.currentAmount != null && String(ctx.currentAmount).length) {
    out = out.replace(/\{currentAmount\}/g, String(ctx.currentAmount))
  }
  if (ctx.goalAmount != null && String(ctx.goalAmount).length) {
    out = out.replace(/\{goalAmount\}/g, String(ctx.goalAmount))
  }
  if (ctx.percent != null) {
    out = out.replace(/\{percent\}/g, String(ctx.percent))
  }
  if (ctx.minThb != null) {
    out = out.replace(/\{minThb\}/g, String(ctx.minThb))
  }
  if (ctx.code != null) {
    out = out.replace(/\{code\}/g, String(ctx.code))
  }
  if (ctx.feePercent != null) {
    out = out.replace(/\{feePercent\}/g, String(ctx.feePercent))
  }
  if (ctx.netThb != null) {
    out = out.replace(/\{netThb\}/g, String(ctx.netThb))
  }
  if (ctx.amount != null) {
    out = out.replace(/\{amount\}/g, String(ctx.amount))
  }
  if (ctx.active != null) {
    out = out.replace(/\{active\}/g, String(ctx.active))
  }
  if (ctx.total != null) {
    out = out.replace(/\{total\}/g, String(ctx.total))
  }
  return out
}

/** Stage 155.3 — `{providerDative}`, `{checkInLabel}`, … from listing vertical. */
function applyGuestBookingLabelPlaceholders(str, lang, ctx) {
  if (typeof str !== 'string' || !ctx || typeof ctx !== 'object' || !ctx.listingCategorySlug) {
    return str
  }
  const ph = getGuestBookingLabelPlaceholders({
    categorySlug: ctx.listingCategorySlug,
    wizardProfile: ctx.wizardProfile,
    language: lang,
  })
  let out = str
  for (const [key, value] of Object.entries(ph)) {
    if (value == null) continue
    out = out.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value))
  }
  return out
}

/**
 * Локализованное сообщение для `error_code` из `/api/v2/auth/*`, рефералов и промо (`PROMO_*`).
 * Неизвестные `REFERRAL_*` → `AUTH_REFERRAL_GENERIC`; неизвестные `PROMO_*` → `PROMO_INVALID`.
 * @param {Record<string, unknown>} [extras] — например `{ minAmountThb }` для `PROMO_MIN_AMOUNT_NOT_MET`.
 */
export function getAuthErrorMessage(code, lang = DEFAULT_UI_LANGUAGE, extras = {}) {
  if (!code || typeof code !== 'string') return getUIText('AUTH_UNKNOWN', lang)
  let localized = getUIText(code, lang)
  if (localized === code && code.startsWith('REFERRAL_')) localized = getUIText('AUTH_REFERRAL_GENERIC', lang)
  if (localized === code && code.startsWith('PROMO_')) localized = getUIText('PROMO_INVALID', lang)
  if (localized === code) return getUIText('AUTH_UNKNOWN', lang)
  if (
    code === 'PROMO_MIN_AMOUNT_NOT_MET' &&
    extras &&
    typeof extras === 'object' &&
    extras.minAmountThb != null &&
    typeof localized === 'string'
  ) {
    return localized.replace(/\{minAmount\}/g, String(extras.minAmountThb))
  }
  return localized
}

/**
 * @param {string} key
 * @param {string} [lang]
 * @param {{ listingCategorySlug?: string, welcomeThb?: string|number, welcomeApprox?: string }} [ctx] — vertical override или плейсхолдеры `{welcomeThb}` / `{welcomeApprox}`.
 */
export function getUIText(key, lang = DEFAULT_UI_LANGUAGE, ctx) {
  const tableLang = uiTranslations[lang] ? lang : DEFAULT_UI_LANGUAGE
  const primary = uiTranslations[tableLang] || {}
  const fallback = uiTranslations[DEFAULT_UI_LANGUAGE] || {}
  const altKey =
    ctx && typeof ctx === 'object' && ctx.listingCategorySlug
      ? resolveVerticalOverrideRawKey(key, ctx.listingCategorySlug, ctx.wizardProfile)
      : null
  if (altKey) {
    const altRaw = primary[altKey] ?? fallback[altKey]
    if (typeof altRaw === 'string' && altRaw.length > 0) {
      const withBrand = applyCtxStringPlaceholders(injectBrand(altRaw), ctx)
      return applyGuestBookingLabelPlaceholders(withBrand, tableLang, ctx)
    }
  }
  const raw = primary[key] ?? fallback[key] ?? key
  const withBrand = applyCtxStringPlaceholders(injectBrand(typeof raw === 'string' ? raw : String(raw)), ctx)
  return applyGuestBookingLabelPlaceholders(withBrand, tableLang, ctx)
}

export function t(lang = DEFAULT_UI_LANGUAGE) {
  return (key, ctx) => getUIText(key, lang, ctx)
}

export function getListingText(listing, field, lang = DEFAULT_UI_LANGUAGE) {
  const translations =
    listing?.metadata?.[`${field}_translations`] || listing?.[`${field}_translations`]

  if (translations && translations[lang]) {
    return translations[lang]
  }
  return listing?.[field] || ''
}

function getLanguageFromDocumentCookie() {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${LANG_COOKIE_NAME}=([^;]*)`),
  )
  if (!match) return null
  const raw = String(match[1] || '')
    .trim()
    .replace(/\+/g, ' ')
  let decoded = raw
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    // ignore
  }
  if (supportedLanguages.find((l) => l.code === decoded)) return decoded
  return null
}

export function detectLanguage() {
  if (typeof window === 'undefined') return DEFAULT_UI_LANGUAGE

  const stored = localStorage.getItem('gostaylo_language')
  if (stored && supportedLanguages.find((l) => l.code === stored)) {
    return stored
  }

  const fromCookie = getLanguageFromDocumentCookie()
  if (fromCookie) return fromCookie

  const browserLang = navigator.language?.slice(0, 2).toLowerCase()
  const supported = supportedLanguages.find((l) => l.code === browserLang)
  return supported ? browserLang : DEFAULT_UI_LANGUAGE
}

/**
 * Сохраняет язык в localStorage и cookie `gostaylo_language` (для SSR metadata и первого hit без LS).
 * Вызывать при смене языка в I18nProvider / любых setLanguage.
 */
export function setLanguage(lang) {
  if (typeof window === 'undefined') return
  localStorage.setItem('gostaylo_language', lang)
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${LANG_COOKIE_NAME}=${encodeURIComponent(
    lang,
  )}; path=/; max-age=${LANG_COOKIE_MAX_AGE}; SameSite=Lax${secure}`
}

/**
 * SSR/Edge: 1) cookie gostaylo_language 2) Accept-Language 3) {@link DEFAULT_UI_LANGUAGE}
 */
export function getLangFromRequest(cookieStore, headers) {
  const cookie = cookieStore?.get?.(LANG_COOKIE_NAME)?.value
  if (cookie && supportedLanguages.find((l) => l.code === cookie)) {
    return cookie
  }
  const acceptRaw = headers?.get?.('accept-language') || ''
  const first = String(acceptRaw)
    .split(/[;,]/)[0]
    ?.trim()
    .replace('_', '-')
  const fromAccept = first?.toLowerCase().split('-').filter(Boolean)[0] || null
  if (fromAccept && supportedLanguages.find((l) => l.code === fromAccept)) {
    return fromAccept
  }
  return DEFAULT_UI_LANGUAGE
}
