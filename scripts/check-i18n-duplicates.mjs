/**
 * Stage 61.0 — fail if the same UI key appears in more than one merge source (silent override risk).
 * Usage: node scripts/check-i18n-duplicates.mjs
 */
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const sources = [
  ['common', () => import(pathToFileURL(path.join(root, 'lib/translations/common.js')).href).then((m) => m.commonUi)],
  ['listings-public', () => import(pathToFileURL(path.join(root, 'lib/translations/listings-public.js')).href).then((m) => m.listingsPublicUi)],
  ['listings-partner', () => import(pathToFileURL(path.join(root, 'lib/translations/listings-partner.js')).href).then((m) => m.listingsPartnerUi)],
  ['verticals/base-vertical', () => import(pathToFileURL(path.join(root, 'lib/translations/verticals/base-vertical.js')).href).then((m) => m.baseVerticalUi)],
  ['verticals/helicopters', () => import(pathToFileURL(path.join(root, 'lib/translations/verticals/helicopters.js')).href).then((m) => m.verticalHelicoptersUi)],
  ['slices/partner-finances', () => import(pathToFileURL(path.join(root, 'lib/translations/slices/partner-finances.js')).href).then((m) => m.partnerFinancesUi)],
  ['slices/partner-shell', () => import(pathToFileURL(path.join(root, 'lib/translations/slices/partner-shell.js')).href).then((m) => m.partnerShellUi)],
  ['slices/order-flow', () => import(pathToFileURL(path.join(root, 'lib/translations/slices/order-flow.js')).href).then((m) => m.orderFlowUi)],
  ['slices/reviews-ui', () => import(pathToFileURL(path.join(root, 'lib/translations/slices/reviews-ui.js')).href).then((m) => m.reviewsUi)],
  ['slices/profile-app', () => import(pathToFileURL(path.join(root, 'lib/translations/slices/profile-app.js')).href).then((m) => m.profileAppUi)],
  ['ui (core)', () => import(pathToFileURL(path.join(root, 'lib/translations/ui.js')).href).then((m) => m.coreUi)],
  ['errors', () => import(pathToFileURL(path.join(root, 'lib/translations/errors.js')).href).then((m) => m.errorsUi)],
  ['checkout', () => import(pathToFileURL(path.join(root, 'lib/translations/checkout.js')).href).then((m) => m.checkoutUi)],
  ['partner-calendar-modals', () => import(pathToFileURL(path.join(root, 'lib/translations/partner-calendar-modals.js')).href).then((m) => m.partnerCalendarModalsUi)],
  ['renter-reviews-flow', () => import(pathToFileURL(path.join(root, 'lib/translations/renter-reviews-flow.js')).href).then((m) => m.renterReviewsFlowUi)],
]

const LANGS = ['ru', 'en', 'zh', 'th']

const loaded = []
for (const [name, loader] of sources) {
  loaded.push([name, await loader()])
}

let exit = 0
for (const lang of LANGS) {
  const keyToSources = new Map()
  for (const [name, bundle] of loaded) {
    const dict = bundle[lang] || {}
    for (const key of Object.keys(dict)) {
      if (!keyToSources.has(key)) keyToSources.set(key, [])
      keyToSources.get(key).push(name)
    }
  }
  for (const [key, names] of keyToSources) {
    if (names.length > 1) {
      console.error(`[${lang}] DUPLICATE KEY "${key}":`, names.join(' + '))
      exit = 1
    }
  }
}

if (exit === 0) {
  console.log('check-i18n-duplicates: OK (no duplicate keys across merge sources per locale).')
}
process.exit(exit)
