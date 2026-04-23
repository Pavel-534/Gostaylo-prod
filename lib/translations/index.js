/**
 * GoStayLo i18n — merged UI strings + helpers.
 * Slices: common, listings (public + partner), errors, ui (dashboard / renter / partner chrome).
 */

import { categoryTranslations, amenityTranslations } from './categories'
import { uiTranslations } from './translation-state'

const LANGS = ['ru', 'en', 'zh', 'th']

/** Канонический fallback UI / SSR (совпадает с I18nProvider и `getLangFromRequest`). */
export const DEFAULT_UI_LANGUAGE = 'ru'

const LANG_COOKIE_NAME = 'gostaylo_language'
const LANG_COOKIE_MAX_AGE = 60 * 60 * 24 * 400

/** @deprecated Use `import { uiTranslations } from '@/lib/translations/translation-state'` */
export { uiTranslations }

export const supportedLanguages = [
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'th', name: 'ไทย', flag: '🇹🇭' },
]

export { categoryTranslations, amenityTranslations }

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

export function getUIText(key, lang = DEFAULT_UI_LANGUAGE) {
  return uiTranslations[lang]?.[key] || uiTranslations[DEFAULT_UI_LANGUAGE][key] || key
}

export function t(lang = DEFAULT_UI_LANGUAGE) {
  return (key) => getUIText(key, lang)
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
