/**

 * Order flow i18n (my bookings, order cards, help/dispute UI) — lazy route slice (Stage 171.35).

 * @see app/(storefront)/my-bookings/layout.js, app/(storefront)/bookings/layout.js

 */

import { orderFlowUi } from './slices/order-flow'

import { applyI18nSlices } from './apply-i18n-slices'



export function applyOrderFlowI18nSlice() {

  applyI18nSlices(orderFlowUi)

}



applyOrderFlowI18nSlice()

