/**
 * Mutable merged UI dictionary — **minimal root core** (Stage 171.37).
 * Errors / promo / renter review flow — `register-errors-i18n.js`, `register-renter-reviews-i18n.js`.
 */
import { authChromeUi } from './slices/auth-chrome'
import { coreUi } from './ui'
import { baseVerticalUi } from './verticals/base-vertical'
import { verticalHelicoptersUi } from './verticals/helicopters'
import { bookingStatusUi } from './slices/booking-status'

const LANGS = ['ru', 'en', 'zh', 'th']

/**
 * Merge order = priority (later keys override earlier). Core chrome last among product UI
 * so slices can be split without shadowing errors/checkout.
 */
function mergeSlices(lang) {
  return {
    ...authChromeUi[lang],
    ...baseVerticalUi[lang],
    ...verticalHelicoptersUi[lang],
    ...bookingStatusUi[lang],
    ...coreUi[lang],
  }
}

export const uiTranslations = Object.fromEntries(LANGS.map((l) => [l, mergeSlices(l)]))

export { LANGS }
