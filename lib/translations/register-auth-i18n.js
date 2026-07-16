/**
 * Auth modal / login page strings + auth API errors — lazy slice (Stage 171.36).
 * Preloaded with auth modal; login route imports directly.
 */
import { authUi } from './auth'
import { authErrorsUi } from './slices/auth-errors'
import { applyI18nSlices } from './apply-i18n-slices'
import { LANGS } from './translation-state'

function mergeAuthSlices(lang) {
  return {
    ...(authUi[lang] || {}),
    ...(authErrorsUi[lang] || {}),
  }
}

const authSliceByLang = Object.fromEntries(LANGS.map((l) => [l, mergeAuthSlices(l)]))

export function applyAuthI18nSlice() {
  applyI18nSlices(authSliceByLang)
}

applyAuthI18nSlice()
