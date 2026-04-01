/**
 * GoStayLo i18n — merged UI strings + helpers.
 * Slices: common, listings (public + partner), errors, ui (dashboard / renter / partner chrome).
 */

import { categoryTranslations, amenityTranslations } from './categories'
import { commonUi } from './common'
import { listingsPublicUi } from './listings-public'
import { listingsPartnerUi } from './listings-partner'
import { errorsUi } from './errors'
import { uiUi, chatUi } from './ui'

const LANGS = ['ru', 'en', 'zh', 'th']

function mergeLang(lang) {
  return {
    ...commonUi[lang],
    ...listingsPublicUi[lang],
    ...listingsPartnerUi[lang],
    ...uiUi[lang],
    ...chatUi[lang],
    ...errorsUi[lang],
  }
}

/** Full UI dictionary by language code */
export const uiTranslations = Object.fromEntries(LANGS.map((l) => [l, mergeLang(l)]))

export const supportedLanguages = [
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'th', name: 'ไทย', flag: '🇹🇭' },
]

export { categoryTranslations, amenityTranslations }

export function getCategoryName(slug, lang = 'ru', fallback = '') {
  const translations = categoryTranslations[slug?.toLowerCase()]
  if (translations && translations[lang]) {
    return translations[lang]
  }
  return fallback || slug
}

export function getAmenityName(slug, lang = 'ru', fallback = '') {
  const key = slug?.toLowerCase()
  const translations = amenityTranslations[key] || amenityTranslations[key?.replace(/\s+/g, ' ')]
  if (translations && translations[lang]) {
    return translations[lang]
  }
  return fallback || slug
}

export function getUIText(key, lang = 'ru') {
  return uiTranslations[lang]?.[key] || uiTranslations.ru[key] || key
}

export function t(lang = 'ru') {
  return (key) => getUIText(key, lang)
}

export function getListingText(listing, field, lang = 'ru') {
  const translations =
    listing?.metadata?.[`${field}_translations`] || listing?.[`${field}_translations`]

  if (translations && translations[lang]) {
    return translations[lang]
  }
  return listing?.[field] || ''
}

export function detectLanguage() {
  if (typeof window === 'undefined') return 'ru'

  const stored = localStorage.getItem('gostaylo_language')
  if (stored && supportedLanguages.find((l) => l.code === stored)) {
    return stored
  }

  const browserLang = navigator.language?.slice(0, 2).toLowerCase()
  const supported = supportedLanguages.find((l) => l.code === browserLang)
  return supported ? browserLang : 'ru'
}

export function setLanguage(lang) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('gostaylo_language', lang)
  }
}

export function getLangFromRequest(cookieStore, headers) {
  const cookie = cookieStore?.get?.('gostaylo_language')?.value
  if (cookie && supportedLanguages.find((l) => l.code === cookie)) return cookie
  const acceptLang = headers?.get?.('accept-language')?.split(',')[0]?.slice(0, 2)?.toLowerCase()
  const supported = supportedLanguages.find((l) => l.code === acceptLang)
  return supported ? acceptLang : 'en'
}
