/**
 * Stage 201.60 — splash plate icons + partner mobile toolbar → FAB.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-60-splash-plate-partner-fab.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel))
}

describe('Stage 201.60 — splash plate + partner cabinet FAB', () => {
  it('manifest uses large-mark white plate splash icons + maskable home', () => {
    const man = read('app/manifest.js')
    assert.match(man, /icon-splash-512x512\.png/)
    assert.match(man, /purpose:\s*['\"]any['\"]/)
    assert.match(man, /icon-maskable-512x512\.png/)
    assert.match(man, /purpose:\s*['\"]maskable['\"]/)
    assert.doesNotMatch(man, /icon-android-splash/)
    assert.ok(exists('public/icons/icon-splash-512x512.png'))

    const script = read('scripts/build-android-splash-icons.mjs')
    assert.match(script, /MARK_FRAC\s*=\s*0\.82/)
    assert.match(script, /buildSplashPlateIcon/)
    assert.match(script, /airento-mark\.svg/)
  })

  it('partner mobile breadcrumb toolbar removed; cabinet bell is FAB SSOT', () => {
    const layout = read('app/(partner)/partner/layout.js')
    assert.doesNotMatch(layout, /WORKSPACE_MOBILE_TOOLBAR_CLASS/)
    assert.match(layout, /PartnerCabinetMobileActionsFab/)
    assert.match(layout, /!isListingWizardRoute \? \(\s*<PartnerCabinetMobileActionsFab/)

    const fab = read('components/partner/PartnerCabinetMobileActionsFab.jsx')
    assert.match(fab, /partner-cabinet-actions-fab/)
    assert.match(fab, /MOBILE_ACTION_FAB_BUTTON_CLASS/)
    assert.match(fab, /PartnerNotificationFeed/)

    const shared = read('lib/layout/mobile-action-fab.js')
    assert.match(shared, /MOBILE_ACTION_FAB_STACK_CLASS/)
    assert.match(shared, /MOBILE_ACTION_FAB_TOP_UNDER_HEADER/)

    const wizardFab = read(
      'app/(partner)/partner/listings/new/components/chrome/ListingWizardMobileActionsFab.jsx',
    )
    assert.match(wizardFab, /MOBILE_ACTION_FAB_BUTTON_CLASS/)
    assert.match(wizardFab, /MOBILE_ACTION_FAB_TOP_UNDER_WIZARD_CHROME/)

    const pdp = read('app/(storefront)/listings/[id]/components/ListingPageNav.jsx')
    assert.match(pdp, /MOBILE_ACTION_FAB_BUTTON_CLASS/)
  })
})
