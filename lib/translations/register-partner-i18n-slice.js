/**
 * Partner-only i18n — loaded with `(partner)` route group, not root layout (Stage 171.31).
 */
import { listingsPartnerUi } from './listings-partner'
import { partnerFinancesUi } from './slices/partner-finances'
import { partnerUiStrings } from './slices/partner-ui'
import { partnerShellUi } from './slices/partner-shell'
import { partnerCalendarModalsUi } from './partner-calendar-modals'
import { applyI18nSlices } from './apply-i18n-slices'
import { LANGS } from './translation-state'

function mergePartnerSlices(lang) {
  return {
    ...(listingsPartnerUi[lang] || {}),
    ...(partnerFinancesUi[lang] || {}),
    ...(partnerUiStrings[lang] || {}),
    ...(partnerShellUi[lang] || {}),
    ...(partnerCalendarModalsUi[lang] || {}),
  }
}

const partnerSliceByLang = Object.fromEntries(LANGS.map((l) => [l, mergePartnerSlices(l)]))

export function applyPartnerI18nSlice() {
  applyI18nSlices(partnerSliceByLang)
}

applyPartnerI18nSlice()
