/**
 * Profile / referral / product settings i18n — not in root bundle (Stage 171.31).
 */
import { profileAppUi } from './slices/profile-app'
import { reviewsUi } from './slices/reviews-ui'
import { applyI18nSlices } from './apply-i18n-slices'
import { LANGS } from './translation-state'

function mergeProfileSlices(lang) {
  return {
    ...(profileAppUi[lang] || {}),
    ...(reviewsUi[lang] || {}),
  }
}

const profileSliceByLang = Object.fromEntries(LANGS.map((l) => [l, mergeProfileSlices(l)]))

export function applyProfileI18nSlice() {
  applyI18nSlices(profileSliceByLang)
}

applyProfileI18nSlice()
