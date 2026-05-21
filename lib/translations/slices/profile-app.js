/**
 * Profile, partner application, Telegram connect, renter settings, public profile, roles.
 * Stage 109.1 — composition of topic slices (merged in translation-state.js).
 */
import { profileAppCoreUi } from './profile-app-core'
import { profileAppPartnerUi } from './profile-app-partner'
import { profileAppRenterUi } from './profile-app-renter'
import { profileAppReferralUi } from './profile-app-referral'

const LANGS = ['ru', 'en', 'zh', 'th']
const SLICES = [profileAppCoreUi, profileAppPartnerUi, profileAppRenterUi, profileAppReferralUi]

function mergeSlices() {
  return Object.fromEntries(
    LANGS.map((lang) => [
      lang,
      SLICES.reduce((acc, slice) => ({ ...acc, ...(slice[lang] || {}) }), {}),
    ]),
  )
}

/** @deprecated Import topic slices directly for new keys; this export preserves legacy imports. */
export const profileAppUi = mergeSlices()
