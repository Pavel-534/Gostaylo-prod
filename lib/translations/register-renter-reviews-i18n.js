/**

 * Renter review submission flow (/renter/reviews/new) — lazy slice (Stage 171.37).

 * @see app/(storefront)/renter/reviews/layout.js

 */

import { renterReviewsFlowUi } from './renter-reviews-flow'

import { applyI18nSlices } from './apply-i18n-slices'



export function applyRenterReviewsFlowI18nSlice() {

  applyI18nSlices(renterReviewsFlowUi)

}



applyRenterReviewsFlowI18nSlice()

