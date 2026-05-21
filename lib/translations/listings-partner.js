/**
 * UI translations — partner listing editor, dashboard listing flows, iCal calendar.
 * Stage 109.1 — composition of topic slices (SSOT keys unchanged).
 */
import { listingsPartnerCoreUi } from './listings-partner-core'
import { listingsPartnerWizardUi } from './listings-partner-wizard'
import { listingsPartnerFinancesUi } from './listings-partner-finances'
import { listingsPartnerCalendarUi } from './listings-partner-calendar'

const LANGS = ['ru', 'en', 'zh', 'th']
const SLICES = [
  listingsPartnerCoreUi,
  listingsPartnerWizardUi,
  listingsPartnerFinancesUi,
  listingsPartnerCalendarUi,
]

function mergeSlices() {
  return Object.fromEntries(
    LANGS.map((lang) => [
      lang,
      SLICES.reduce((acc, slice) => ({ ...acc, ...(slice[lang] || {}) }), {}),
    ]),
  )
}

/** @deprecated Import topic slices directly for new keys; this export preserves legacy imports. */
export const listingsPartnerUi = mergeSlices()
