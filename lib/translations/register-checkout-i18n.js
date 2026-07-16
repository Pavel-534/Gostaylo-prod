/**
 * Checkout / payment flow i18n — lazy route slice (Stage 171.33).
 * @see app/checkout/layout.js
 */
import { checkoutUi } from './checkout'
import { applyI18nSlices } from './apply-i18n-slices'

export function applyCheckoutI18nSlice() {
  applyI18nSlices(checkoutUi)
}

applyCheckoutI18nSlice()
