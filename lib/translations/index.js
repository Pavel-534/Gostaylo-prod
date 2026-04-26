/**
 * i18n — merged UI strings + helpers.
 * Slices: common, listings (public + partner), errors, ui (dashboard / renter / partner chrome).
 */

import { categoryTranslations, amenityTranslations } from './categories'
import { uiTranslations } from './translation-state'
import { resolveVerticalOverrideRawKey } from './vertical-context'
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

/**
 * @param {string} key
 * @param {string} [lang]
 * @param {{ listingCategorySlug?: string }} [ctx] — when slug maps to a vertical (e.g. helicopter), tries `verticalHelicopters_${key}` first.
 */
export function getUIText(key, lang = DEFAULT_UI_LANGUAGE, ctx) {
  const tableLang = uiTranslations[lang] ? lang : DEFAULT_UI_LANGUAGE
  const primary = uiTranslations[tableLang] || {}
  const fallback = uiTranslations[DEFAULT_UI_LANGUAGE] || {}
  const altKey =
    ctx && typeof ctx === 'object' && ctx.listingCategorySlug
      ? resolveVerticalOverrideRawKey(key, ctx.listingCategorySlug)
      : null
  if (altKey) {
    const altRaw = primary[altKey] ?? fallback[altKey]
    if (typeof altRaw === 'string' && altRaw.length > 0) {
      return injectBrand(altRaw)
    }
  }
  const raw = primary[key] ?? fallback[key] ?? key
  return injectBrand(typeof raw === 'string' ? raw : String(raw))
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
