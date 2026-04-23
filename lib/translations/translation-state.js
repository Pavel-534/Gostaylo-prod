/**
 * Mutable merged UI dictionary (base bundle without chat).
 * Chat slice: `slices/chat-ui.js` + `register-chat-slice.js` (messages route).
 */
import { commonUi } from './common'
import { listingsPublicUi } from './listings-public'
import { listingsPartnerUi } from './listings-partner'
import { errorsUi } from './errors'
import { uiUi } from './ui'
import { checkoutUi } from './checkout'
import { partnerCalendarModalsUi } from './partner-calendar-modals'
import { renterReviewsFlowUi } from './renter-reviews-flow'

const LANGS = ['ru', 'en', 'zh', 'th']

function mergeBase(lang) {
  return {
    ...commonUi[lang],
    ...listingsPublicUi[lang],
    ...listingsPartnerUi[lang],
    ...uiUi[lang],
    ...errorsUi[lang],
    ...checkoutUi[lang],
    ...partnerCalendarModalsUi[lang],
    ...renterReviewsFlowUi[lang],
  }
}

export const uiTranslations = Object.fromEntries(LANGS.map((l) => [l, mergeBase(l)]))

export { LANGS }
