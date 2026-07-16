/**
 * Guest listings i18n (catalog, PDP, cards) — lazy route slice (Stage 171.33).
 * @see app/(storefront)/listings/layout.js, app/(storefront)/page.js (home cards)
 */
import { listingsPublicUi } from './listings-public'
import { catalogSeoUi } from './slices/catalog-seo'
import { applyI18nSlices } from './apply-i18n-slices'
import { LANGS } from './translation-state'

function mergeListingsPublicSlices(lang) {
  return {
    ...(listingsPublicUi[lang] || {}),
    ...(catalogSeoUi[lang] || {}),
  }
}

const listingsPublicSliceByLang = Object.fromEntries(
  LANGS.map((l) => [l, mergeListingsPublicSlices(l)]),
)

export function applyListingsPublicI18nSlice() {
  applyI18nSlices(listingsPublicSliceByLang)
}

applyListingsPublicI18nSlice()
