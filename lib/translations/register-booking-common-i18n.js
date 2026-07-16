/**
 * Shared booking/dispute UI strings — lazy slice (Stage 171.36).
 * @see checkout layout, order-flow routes.
 */
import { bookingUi } from './booking'
import { applyI18nSlices } from './apply-i18n-slices'

export function applyBookingCommonI18nSlice() {
  applyI18nSlices(bookingUi)
}

applyBookingCommonI18nSlice()
