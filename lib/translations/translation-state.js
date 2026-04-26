/**
 * Mutable merged UI dictionary (base bundle without chat).
 * Chat slice: `slices/chat-ui.js` + `register-chat-slice.js` (messages route).
 * Stage 61.0–62.0: modular slices + `verticals/*` (helicopter overlay keys merged globally).
 * Stage 69.2: `catalog-seo` slice — SEO `/listings` (ключи `catalogSeo_*`).
 */
import { commonUi } from './common'
import { listingsPublicUi } from './listings-public'
import { listingsPartnerUi } from './listings-partner'
import { errorsUi } from './errors'
import { coreUi } from './ui'
import { checkoutUi } from './checkout'
import { partnerCalendarModalsUi } from './partner-calendar-modals'
import { renterReviewsFlowUi } from './renter-reviews-flow'
import { baseVerticalUi } from './verticals/base-vertical'
import { verticalHelicoptersUi } from './verticals/helicopters'
import { partnerFinancesUi } from './slices/partner-finances'
import { partnerShellUi } from './slices/partner-shell'
import { orderFlowUi } from './slices/order-flow'
import { reviewsUi } from './slices/reviews-ui'
import { profileAppUi } from './slices/profile-app'
import { catalogSeoUi } from './slices/catalog-seo'

const LANGS = ['ru', 'en', 'zh', 'th']

/**
 * Merge order = priority (later keys override earlier). Core chrome last among product UI
 * so slices can be split without shadowing errors/checkout.
 */
function mergeSlices(lang) {
  return {
    ...commonUi[lang],
    ...listingsPublicUi[lang],
    ...catalogSeoUi[lang],
    ...listingsPartnerUi[lang],
    ...baseVerticalUi[lang],
    ...verticalHelicoptersUi[lang],
    ...partnerFinancesUi[lang],
    ...partnerShellUi[lang],
    ...orderFlowUi[lang],
    ...reviewsUi[lang],
    ...profileAppUi[lang],
    ...coreUi[lang],
    ...errorsUi[lang],
    ...checkoutUi[lang],
    ...partnerCalendarModalsUi[lang],
    ...renterReviewsFlowUi[lang],
  }
}

export const uiTranslations = Object.fromEntries(LANGS.map((l) => [l, mergeSlices(l)]))

export { LANGS }
