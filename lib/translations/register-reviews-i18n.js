/**
 * Review modal / renter review flow strings — lazy slice (Stage 171.36).
 */
import { reviewsUi } from './slices/reviews-ui'
import { applyI18nSlices } from './apply-i18n-slices'

export function applyReviewsI18nSlice() {
  applyI18nSlices(reviewsUi)
}

applyReviewsI18nSlice()
