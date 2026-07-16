/**
 * Client i18n slice presets — mirror server `register-*-i18n` layouts (Stage 171.38).
 * Import apply* only (no route layout side-effects on client beyond bootstrap).
 */
import { applyStorefrontCommonI18nSlice } from './register-storefront-common-i18n'
import { applyErrorsI18nSlice } from './register-errors-i18n'
import { applyListingsPublicI18nSlice } from './register-listings-public-i18n'
import { applyBookingCommonI18nSlice } from './register-booking-common-i18n'
import { applyCheckoutI18nSlice } from './register-checkout-i18n'
import { applyOrderFlowI18nSlice } from './register-order-flow-i18n'
import { applyReviewsI18nSlice } from './register-reviews-i18n'
import { applyChatI18nSlice } from './register-chat-slice'
import { applyPartnerI18nSlice } from './register-partner-i18n-slice'
import { applyProfileI18nSlice } from './register-profile-i18n-slice'
import { applyRenterReviewsFlowI18nSlice } from './register-renter-reviews-i18n'
import { applyAuthI18nSlice } from './register-auth-i18n'

/** @typedef {'storefront'|'pdp'|'checkout'|'orderFlow'|'chat'|'partner'|'profile'|'renterReviews'|'auth'} I18nSlicePreset */

/** @type {Record<I18nSlicePreset, Array<() => void>>} */
export const I18N_SLICE_PRESETS = {
  /** Home, catalog, shared chrome — `(storefront)/layout.js` */
  storefront: [
    applyStorefrontCommonI18nSlice,
    applyErrorsI18nSlice,
    applyListingsPublicI18nSlice,
  ],
  /** PDP booking widget — listings public from storefront parent */
  pdp: [applyBookingCommonI18nSlice],
  /** `/checkout/[id]` — outside `(storefront)` group */
  checkout: [
    applyCheckoutI18nSlice,
    applyStorefrontCommonI18nSlice,
    applyBookingCommonI18nSlice,
    applyErrorsI18nSlice,
  ],
  /** My bookings / order cards */
  orderFlow: [
    applyOrderFlowI18nSlice,
    applyBookingCommonI18nSlice,
    applyReviewsI18nSlice,
  ],
  chat: [applyChatI18nSlice],
  partner: [
    applyPartnerI18nSlice,
    applyOrderFlowI18nSlice,
    applyErrorsI18nSlice,
  ],
  /** Profile + AccountConnections (auth provider labels) */
  profile: [applyProfileI18nSlice, applyAuthI18nSlice],
  renterReviews: [applyRenterReviewsFlowI18nSlice],
  /** `/auth/*` immersive shell — mirrors `app/auth/layout.js` */
  auth: [
    applyAuthI18nSlice,
    applyStorefrontCommonI18nSlice,
    applyErrorsI18nSlice,
  ],
}

/**
 * @param {I18nSlicePreset} preset
 * @returns {Array<() => void>}
 */
export function getI18nSliceAppliers(preset) {
  const appliers = I18N_SLICE_PRESETS[preset]
  if (!appliers) {
    throw new Error(`Unknown i18n slice preset: ${preset}`)
  }
  return appliers
}
