/**
 * One-off: extract uiTranslations from lib/translations.js and split into 4 buckets.
 * Run: node scripts/split-translations.mjs
 */
import fs from 'fs'
import vm from 'vm'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const srcPath = path.join(root, 'lib', 'translations.js')
const src = fs.readFileSync(srcPath, 'utf8')

const dataPart = src
  .replace(/\/\*\*[\s\S]*?\*\/\s*/m, '')
  .replace(/^export const (categoryTranslations|amenityTranslations|uiTranslations|supportedLanguages)/gm, 'var $1')
  .replace(/^export function /gm, 'function ')

const ctx = { console }
vm.createContext(ctx)
vm.runInContext(
  dataPart +
    `
; globalThis.__data = {
  categoryTranslations,
  amenityTranslations,
  uiTranslations,
  supportedLanguages
};
`,
  ctx
)

const { uiTranslations } = ctx.__data
const LANGS = ['ru', 'en', 'zh', 'th']

function bucketKey(key) {
  if (
    /(Error|error|failed|Failed|invalid|Invalid|loadError|failedToLoad|failedToLoadListing|invalidCoords|urlError)/.test(
      key
    )
  ) {
    return 'errors'
  }
  if (
    /^(listingPage|currentListings|found|objects|loadingMore|noResults|showList|showMap|loadMore|more|showingXofY|listingsUnavailable|tryChangingFilters|newListing|night|nights|perNight|travelDates|numberOfGuests|serviceFee|total|meetYourHost|propertyOwner|selectDatesToBook|selectYourDates|showAllReviews|whereYoullBe|thailand|guests|bedrooms|bathrooms|reviews|listingPageTitle|listingPageDesc|createNewListing|editListing|saveDraft|exit|basics|location|specs|pricing|gallery|tellUsAboutListing|startWithBasics|selectCategory|selectCategoryPlaceholder|titlePlaceholder|descriptionPlaceholder|whereIsListing|helpGuestsFind|selectDistrict|selectDistrictPlaceholder|mapLocation|clickToPin|openMapPicker|comingSoon|notSet|listingSpecs|addDetailsFor|amenities|pricingAndBooking|setRates|basePrice|basePricePlaceholder|commissionRate|standardRate|minStay|maxStay|addPhotos|showcasePhotos|dragDropImages|orClickToBrowse|selectFiles|back|next|publishListing|updateListing|livePreview|thisIsHowGuestsSee|continueFilling|selectCategoryToSeeFields|characters|pleaseLogIn|draftSaved|listingUpdated|listingPublished|failedToLoadListing|manualCoords|latitude|longitude|searchAddress|searchAddressPlaceholder|search|seasonalPricing|seasonalPricingDesc|addSeason|seasonLabel|seasonStart|seasonEnd|seasonPrice|removeSeason|partnerCal_)/.test(
      key
    )
  ) {
    return 'listings'
  }
  if (
    /^(memberSince|profileCompletion|completeProfileToUnlock|profileComplete|startEarning|listYourProperty|commissionZero|keepAllEarnings|support247|alwaysHere|fastPayouts|quickPayments|applyBecomePartner|telegramNotifications|instantUpdates|sendCodeToBot|copy|codeCopied|generating|connectTelegram|openTelegramBot|quickActions|partnerApplication|partnerApplicationDesc|phoneNumber|hostingExperience|submitApplication|applicationDeclined|reapply|welcomePartnerTitle|welcomePartnerBody|welcomePartnerButton|myBookingsTitle|manageTrips|findStay|all|upcoming|past|cancelled|noBookings|noUpcomingTrips|noPastTrips|noCancelledBookings|startSearchingPhuket|bookNextTrip|noCompletedTrips|allBookingsActive|financesTitle|financesDesc|totalGrossRevenue|beforeFees|platformFee|netEarnings|yourShare|transactions|completed|completedRevenue|fundsFromCompleted|pendingRevenue|upcomingBookings|transactionHistory|transactionHistoryDesc|exportCSV|guest|gross|fee|yourNetEarnings|howPayoutsWork|payoutsInfo|noTransactions|noTransactionsDesc|reportDownloaded|noTransactionsExport|listing|retry)/.test(
      key
    )
  ) {
    return 'ui'
  }
  return 'common'
}

const buckets = { common: {}, listings: {}, errors: {}, ui: {} }

for (const lang of LANGS) {
  const slice = uiTranslations[lang] || {}
  buckets.common[lang] = {}
  buckets.listings[lang] = {}
  buckets.errors[lang] = {}
  buckets.ui[lang] = {}
  for (const key of Object.keys(slice)) {
    const b = bucketKey(key)
    buckets[b][lang][key] = slice[key]
  }
}

function escStr(s) {
  return JSON.stringify(s)
}

function emitObject(obj, indent = 4) {
  const sp = ' '.repeat(indent)
  const lines = Object.entries(obj).map(([k, v]) => {
    const key = /^[a-zA-Z_$][\w$]*$/.test(k) ? k : escStr(k)
    return `${sp}${key}: ${escStr(v)},`
  })
  return lines.join('\n')
}

function emitLangBlock(langObj, indent = 4) {
  const sp = ' '.repeat(indent)
  const langs = LANGS.map(
    (lang) => `${sp}${lang}: {\n${emitObject(langObj[lang], indent + 2)}\n${sp}},`
  )
  return langs.join('\n')
}

const outDir = path.join(root, 'lib', 'translations')
fs.mkdirSync(outDir, { recursive: true })

for (const name of ['common', 'listings', 'errors', 'ui']) {
  const body = emitLangBlock(buckets[name])
  const content = `/**
 * UI translations — ${name} (auto-split from translations.js)
 */
export const ${name}Ui = {
${body}
}
`
  fs.writeFileSync(path.join(outDir, `${name}.js`), content, 'utf8')
}

console.log(
  'Counts:',
  LANGS.map((l) => `ru:${Object.keys(buckets.common.ru).length}+...`).join(),
  Object.keys(buckets.common.ru).length,
  Object.keys(buckets.listings.ru).length,
  Object.keys(buckets.errors.ru).length,
  Object.keys(buckets.ui.ru).length
)
