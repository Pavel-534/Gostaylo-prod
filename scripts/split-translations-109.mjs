/**
 * Stage 109.1 — one-time splitter for listings-partner + profile-app translations.
 * Run: node scripts/split-translations-109.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = path.resolve(import.meta.dirname, '..')

function categorizeListingsPartnerKey(key) {
  if (key.startsWith('partnerCal_')) return 'calendar'
  if (
    key.startsWith('seasonalMgr_') ||
    key.startsWith('seasonalPricing') ||
    key.startsWith('seasonal') ||
    key.startsWith('season') ||
    key.startsWith('partnerDuration') ||
    key.startsWith('partnerCommission') ||
    key.startsWith('systemCommission') ||
    key === 'totalGrossRevenue' ||
    key === 'commissionRate' ||
    key === 'standardRate' ||
    key === 'pricePerDayShort' ||
    key === 'pricePerMonthOptional' ||
    key === 'seasonAddedToast' ||
    key === 'seasonFillErrorToast' ||
    key === 'defaultListingSeasonLabel' ||
    key === 'addSeason' ||
    key === 'removeSeason'
  ) {
    return 'finances'
  }
  if (
    key.startsWith('wizard') ||
    key.startsWith('partnerWizard_') ||
    key.startsWith('field') ||
    key.startsWith('improveDescription') ||
    key.startsWith('transmission') ||
    key.startsWith('fuel') ||
    [
      'createNewListing',
      'editListing',
      'saveDraft',
      'exit',
      'basics',
      'specs',
      'pricing',
      'gallery',
      'tellUsAboutListing',
      'startWithBasics',
      'selectCategory',
      'selectCategoryPlaceholder',
      'titlePlaceholder',
      'descriptionPlaceholder',
      'whereIsListing',
      'helpGuestsFind',
      'selectDistrict',
      'country',
      'region',
      'city',
      'districtHintGlobal',
      'selectDistrictPlaceholder',
      'mapLocation',
      'clickToPin',
      'openMapPicker',
      'comingSoon',
      'notSet',
      'listingSpecs',
      'addDetailsFor',
      'pricingAndBooking',
      'setRates',
      'basePrice',
      'basePricePlaceholder',
      'minStay',
      'maxStay',
      'minStayTourGroup',
      'maxStayTourGroup',
      'addPhotos',
      'showcasePhotos',
      'dragDropImages',
      'orClickToBrowse',
      'selectFiles',
      'back',
      'next',
      'publishListing',
      'updateListing',
      'livePreview',
      'thisIsHowGuestsSee',
      'continueFilling',
      'selectCategoryToSeeFields',
      'characters',
      'listingTitleLabel',
      'listingDescriptionLabel',
      'pleaseLogIn',
      'draftSaved',
      'listingUpdated',
      'listingPublished',
      'manualCoords',
      'latitude',
      'longitude',
      'searchAddress',
      'searchAddressPlaceholder',
      'draftDefaultTitle',
      'photosUploadedToast',
      'uploadFailedToast',
      'geocodeNoResults',
      'geocodeSearchFailed',
      'perNightShort',
      'perMonthShort',
      'coverBadge',
      'previewDistrictPlaceholder',
      'previewTitlePlaceholder',
      'whereIsListingTransport',
      'helpGuestsFindTransport',
      'listingSpecsTransport',
      'addDetailsForTransport',
      'mapLocationTransport',
      'clickToPinTransport',
      'basePriceVehicle',
      'basePriceTour',
      'basePriceTourPlaceholder',
      'minStayVehicle',
      'maxStayVehicle',
      'perBookingDayShort',
      'partnerTourMinMaxBackendHint',
    ].includes(key)
  ) {
    return 'wizard'
  }
  return 'core'
}

function categorizeProfileAppKey(key) {
  if (key.startsWith('referral') || key.startsWith('stage') || key.startsWith('referralFeed_')) {
    return 'referral'
  }
  if (
    key.startsWith('partnerApp') ||
    key.startsWith('partnerKyc') ||
    key.startsWith('partnerPending') ||
    key.startsWith('partnerApplication') ||
    key === 'partnerApplication' ||
    key === 'partnerApplicationDesc' ||
    key === 'partnerTermsConsentRequired' ||
    key === 'startEarning' ||
    key === 'listYourProperty' ||
    key === 'commissionZero' ||
    key === 'keepAllEarnings' ||
    key === 'support247' ||
    key === 'alwaysHere' ||
    key === 'fastPayouts' ||
    key === 'quickPayments' ||
    key === 'applyBecomePartner' ||
    key === 'hostingExperience' ||
    key === 'submitApplication' ||
    key === 'applicationDeclined' ||
    key === 'reapply' ||
    key === 'phoneNumber' ||
    key === 'welcomePartnerTitle' ||
    key === 'welcomePartnerBody' ||
    key === 'welcomePartnerButton' ||
    key === 'partnerAppStatusLoading'
  ) {
    return 'partner'
  }
  if (key.startsWith('renter')) return 'renter'
  if (key.startsWith('telegram') || key.startsWith('connectTelegram') || key === 'sendCodeToBot') {
    return 'renter'
  }
  return 'core'
}

function splitUiByCategory(ui, categorize) {
  const buckets = {}
  for (const lang of Object.keys(ui)) {
    for (const [key, value] of Object.entries(ui[lang])) {
      const cat = categorize(key)
      if (!buckets[cat]) buckets[cat] = { ru: {}, en: {}, zh: {}, th: {} }
      buckets[cat][lang][key] = value
    }
  }
  return buckets
}

function serializeLangBlock(entries, indent = 2) {
  const pad = ' '.repeat(indent)
  const lines = []
  for (const [key, value] of Object.entries(entries)) {
    if (typeof value === 'string' && !value.includes('\n')) {
      lines.push(`${pad}${key}: ${JSON.stringify(value)},`)
    } else if (typeof value === 'string') {
      lines.push(`${pad}${key}:`)
      lines.push(`${pad}  ${JSON.stringify(value)},`)
    } else {
      lines.push(`${pad}${key}: ${JSON.stringify(value)},`)
    }
  }
  return lines.join('\n')
}

function writeSliceFile(relPath, exportName, comment, buckets, category) {
  const data = buckets[category]
  const content = `/**
 * ${comment}
 * Stage 109.1 — split from monolith; merged in parent re-export.
 */
export const ${exportName} = {
  ru: {
${serializeLangBlock(data.ru, 4)}
  },
  en: {
${serializeLangBlock(data.en, 4)}
  },
  zh: {
${serializeLangBlock(data.zh, 4)}
  },
  th: {
${serializeLangBlock(data.th, 4)}
  },
}
`
  const full = path.join(root, relPath)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content, 'utf8')
  return full
}

function mergeLangSlices(slices, langs = ['ru', 'en', 'zh', 'th']) {
  const out = {}
  for (const lang of langs) {
    out[lang] = {}
    for (const slice of slices) {
      Object.assign(out[lang], slice[lang] || {})
    }
  }
  return out
}

function countKeys(ui) {
  return Object.keys(ui.ru || {}).length
}

async function main() {
  const { listingsPartnerUi } = await import(
    pathToFileURL(path.join(root, 'lib/translations/listings-partner.js')).href
  )
  const { profileAppUi } = await import(
    pathToFileURL(path.join(root, 'lib/translations/slices/profile-app.js')).href
  )

  const lpBuckets = splitUiByCategory(listingsPartnerUi, categorizeListingsPartnerKey)
  const lpFiles = {
    core: writeSliceFile(
      'lib/translations/listings-partner-core.js',
      'listingsPartnerCoreUi',
      'Partner listings — list/edit chrome (non-wizard).',
      lpBuckets,
      'core',
    ),
    wizard: writeSliceFile(
      'lib/translations/listings-partner-wizard.js',
      'listingsPartnerWizardUi',
      'Partner listing wizard & create flow.',
      lpBuckets,
      'wizard',
    ),
    finances: writeSliceFile(
      'lib/translations/listings-partner-finances.js',
      'listingsPartnerFinancesUi',
      'Partner listing pricing, seasons, commissions.',
      lpBuckets,
      'finances',
    ),
    calendar: writeSliceFile(
      'lib/translations/listings-partner-calendar.js',
      'listingsPartnerCalendarUi',
      'Partner iCal calendar sync copy.',
      lpBuckets,
      'calendar',
    ),
  }

  const lpMerged = mergeLangSlices([
    (await import(pathToFileURL(lpFiles.core).href)).listingsPartnerCoreUi,
    (await import(pathToFileURL(lpFiles.wizard).href)).listingsPartnerWizardUi,
    (await import(pathToFileURL(lpFiles.finances).href)).listingsPartnerFinancesUi,
    (await import(pathToFileURL(lpFiles.calendar).href)).listingsPartnerCalendarUi,
  ])

  const origLpKeys = countKeys(listingsPartnerUi)
  const mergedLpKeys = countKeys(lpMerged)
  if (origLpKeys !== mergedLpKeys) {
    throw new Error(`listings-partner key mismatch: ${origLpKeys} vs ${mergedLpKeys}`)
  }

  fs.writeFileSync(
    path.join(root, 'lib/translations/listings-partner.js'),
    `/**
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
`,
    'utf8',
  )

  const paBuckets = splitUiByCategory(profileAppUi, categorizeProfileAppKey)
  const paFiles = {
    core: writeSliceFile(
      'lib/translations/slices/profile-app-core.js',
      'profileAppCoreUi',
      'Profile completion, roles, public profile chrome.',
      paBuckets,
      'core',
    ),
    partner: writeSliceFile(
      'lib/translations/slices/profile-app-partner.js',
      'profileAppPartnerUi',
      'Partner application & KYC copy.',
      paBuckets,
      'partner',
    ),
    renter: writeSliceFile(
      'lib/translations/slices/profile-app-renter.js',
      'profileAppRenterUi',
      'Renter profile, settings, Telegram connect.',
      paBuckets,
      'renter',
    ),
    referral: writeSliceFile(
      'lib/translations/slices/profile-app-referral.js',
      'profileAppReferralUi',
      'Referral program UI on profile routes.',
      paBuckets,
      'referral',
    ),
  }

  const paMerged = mergeLangSlices([
    (await import(pathToFileURL(paFiles.core).href)).profileAppCoreUi,
    (await import(pathToFileURL(paFiles.partner).href)).profileAppPartnerUi,
    (await import(pathToFileURL(paFiles.renter).href)).profileAppRenterUi,
    (await import(pathToFileURL(paFiles.referral).href)).profileAppReferralUi,
  ])

  const origPaKeys = countKeys(profileAppUi)
  const mergedPaKeys = countKeys(paMerged)
  if (origPaKeys !== mergedPaKeys) {
    throw new Error(`profile-app key mismatch: ${origPaKeys} vs ${mergedPaKeys}`)
  }

  fs.writeFileSync(
    path.join(root, 'lib/translations/slices/profile-app.js'),
    `/**
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
`,
    'utf8',
  )

  // Update index.js re-exports
  const indexPath = path.join(root, 'lib/translations/index.js')
  let indexSrc = fs.readFileSync(indexPath, 'utf8')
  if (!indexSrc.includes('listings-partner-core')) {
    indexSrc = indexSrc.replace(
      "import { resolveVerticalOverrideRawKey } from './vertical-context'",
      `import { resolveVerticalOverrideRawKey } from './vertical-context'
export { listingsPartnerUi } from './listings-partner'
export { listingsPartnerCoreUi } from './listings-partner-core'
export { listingsPartnerWizardUi } from './listings-partner-wizard'
export { listingsPartnerFinancesUi } from './listings-partner-finances'
export { listingsPartnerCalendarUi } from './listings-partner-calendar'
export { profileAppUi } from './slices/profile-app'
export { profileAppCoreUi } from './slices/profile-app-core'
export { profileAppPartnerUi } from './slices/profile-app-partner'
export { profileAppRenterUi } from './slices/profile-app-renter'
export { profileAppReferralUi } from './slices/profile-app-referral'`,
    )
    fs.writeFileSync(indexPath, indexSrc, 'utf8')
  }

  console.log('listings-partner keys:', {
    core: countKeys((await import(pathToFileURL(lpFiles.core).href)).listingsPartnerCoreUi),
    wizard: countKeys((await import(pathToFileURL(lpFiles.wizard).href)).listingsPartnerWizardUi),
    finances: countKeys((await import(pathToFileURL(lpFiles.finances).href)).listingsPartnerFinancesUi),
    calendar: countKeys((await import(pathToFileURL(lpFiles.calendar).href)).listingsPartnerCalendarUi),
    total: mergedLpKeys,
  })
  console.log('profile-app keys:', {
    core: countKeys((await import(pathToFileURL(paFiles.core).href)).profileAppCoreUi),
    partner: countKeys((await import(pathToFileURL(paFiles.partner).href)).profileAppPartnerUi),
    renter: countKeys((await import(pathToFileURL(paFiles.renter).href)).profileAppRenterUi),
    referral: countKeys((await import(pathToFileURL(paFiles.referral).href)).profileAppReferralUi),
    total: mergedPaKeys,
  })
  console.log('Done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
