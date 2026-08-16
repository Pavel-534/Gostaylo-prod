/**
 * Stage 201.33 — renter favorites chrome + soft-back + phone in settings.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-33-renter-favorites-settings.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.33 — renter favorites / settings', () => {
  it('favorites uses product chrome, not pink/red page-owned back', () => {
    const fav = read('app/(storefront)/renter/favorites/page.js')
    assert.doesNotMatch(fav, /from-pink-500|to-red-500/)
    assert.doesNotMatch(fav, /useSoftBack/)
    assert.doesNotMatch(fav, /ArrowLeft/)
    assert.match(fav, /ProductPageShell/)
    assert.match(fav, /WorkspaceEmptyState/)
  })

  it('favorites listens to UI currency SSOT and avoids full-viewport void', () => {
    const fav = read('app/(storefront)/renter/favorites/page.js')
    assert.match(fav, /useCurrency/)
    assert.match(fav, /currency=\{currency\}/)
    assert.doesNotMatch(fav, /currency=["']THB["']/)
    assert.match(fav, /useFxRatesQuery/)
    assert.match(fav, /layout=["']solo["']/)
    assert.match(fav, /className=["']min-h-0["']/)
  })

  it('renter layout wires storefront soft-back SSOT for settings and favorites', () => {
    const layout = read('app/(storefront)/renter/layout.js')
    assert.match(layout, /resolveStorefrontSoftBack/)
    assert.match(layout, /showSoftBack=\{showSoftBack\}/)
    // Stage 201.53 — drop legacy renter copyright footer; dock pad stays on main
    assert.doesNotMatch(layout, /Rentals worldwide/)
    assert.doesNotMatch(layout, /<footer/)
    assert.match(layout, /pb-bottom-nav/)

    const routes = read('lib/navigation/soft-back-routes.js')
    assert.match(routes, /\/renter\/favorites/)
    assert.match(routes, /\/renter\/settings/)
  })

  it('renter settings has phone field and privacy hint keys', () => {
    const settings = read('app/(storefront)/renter/settings/page.jsx')
    assert.match(settings, /renterSettingsPhone/)
    assert.match(settings, /phone: phone\.trim/)
    assert.match(settings, /setPhone/)

    const i18n = read('lib/translations/slices/profile-app-renter.js')
    assert.match(i18n, /renterSettingsPhone:/)
    assert.match(i18n, /поддержке и админам/)
  })
})
