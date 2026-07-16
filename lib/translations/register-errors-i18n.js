/**

 * Generic errors + promo API codes — lazy slice (Stage 171.37).

 * @see app/(storefront)/layout.js, app/checkout/layout.js, app/auth/layout.js, app/(partner)/layout.js

 */

import { errorsUi } from './errors'

import { promoErrorsUi } from './slices/promo-errors'

import { applyI18nSlices } from './apply-i18n-slices'

import { LANGS } from './translation-state'



function mergeErrorsSlices(lang) {

  return {

    ...(errorsUi[lang] || {}),

    ...(promoErrorsUi[lang] || {}),

  }

}



const errorsSliceByLang = Object.fromEntries(LANGS.map((l) => [l, mergeErrorsSlices(l)]))



export function applyErrorsI18nSlice() {

  applyI18nSlices(errorsSliceByLang)

}



applyErrorsI18nSlice()

