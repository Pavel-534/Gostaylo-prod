/**
 * Storefront common UI (hero, footer, search chrome, PWA install) — lazy slice (Stage 171.36).
 * @see app/(storefront)/layout.js, app/checkout/layout.js
 */
import { commonCoreUi } from './common-ui'
import { profileUi } from './profile'
import { pwaInstallUi } from './slices/pwa-install'
import { applyI18nSlices } from './apply-i18n-slices'
import { LANGS } from './translation-state'

function mergeStorefrontCommonSlices(lang) {
  return {
    ...(commonCoreUi[lang] || {}),
    ...(profileUi[lang] || {}),
    ...(pwaInstallUi[lang] || {}),
  }
}

const storefrontCommonSliceByLang = Object.fromEntries(
  LANGS.map((l) => [l, mergeStorefrontCommonSlices(l)]),
)

export function applyStorefrontCommonI18nSlice() {
  applyI18nSlices(storefrontCommonSliceByLang)
}

applyStorefrontCommonI18nSlice()
