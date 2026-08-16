/**
 * Stage 201.55 — Android splash lockup + wizard FAB chrome + vehicle year typing.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-55-android-splash-wizard-year.test.js
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

describe('Stage 201.55 — android splash / wizard FAB / vehicle year', () => {
  it('manifest uses splash plate icons for Android splash (not lockup-as-icon)', () => {
    const man = read('app/manifest.js')
    assert.match(man, /icon-splash-512x512\.png/)
    assert.match(man, /icon-maskable-512x512\.png/)
    assert.match(man, /background_color:\s*['\"]#0c1623['\"]/)
    assert.doesNotMatch(man, /icon-android-splash/)
    assert.ok(exists('public/icons/icon-splash-512x512.png'))
    assert.ok(exists('public/icons/icon-maskable-512x512.png'))
    assert.ok(exists('public/splash/android-splash-1080-1920.png'))
    assert.ok(exists('scripts/build-android-splash-icons.mjs'))
  })

  it('wizard soft-back is AppHeader SSOT; slim header removed; FABs for bell/save', () => {
    const {
      resolvePartnerSoftBack,
    } = require('../lib/navigation/soft-back-routes.js')
    assert.deepEqual(resolvePartnerSoftBack('/partner/listings/new'), {
      showSoftBack: true,
      softBackFallback: '/partner/listings',
    })
    assert.deepEqual(resolvePartnerSoftBack('/partner/listings/abc'), {
      showSoftBack: true,
      softBackFallback: '/partner/listings',
    })

    assert.equal(
      exists(
        'app/(partner)/partner/listings/new/components/chrome/ListingWizardMobileSlimHeader.jsx',
      ),
      false,
    )
    const chrome = read(
      'app/(partner)/partner/listings/new/components/chrome/ListingWizardMobileChrome.jsx',
    )
    assert.match(chrome, /ListingWizardMobileActionsFab/)
    assert.doesNotMatch(chrome, /SlimHeader/)
    const fab = read(
      'app/(partner)/partner/listings/new/components/chrome/ListingWizardMobileActionsFab.jsx',
    )
    assert.match(fab, /listing-wizard-actions-fab/)
    assert.match(fab, /listing-wizard-save/)
    assert.match(fab, /PartnerNotificationFeed/)
    assert.match(fab, /MOBILE_ACTION_FAB_TOP_UNDER_WIZARD_CHROME/)
    const fabLayout = read('lib/layout/mobile-action-fab.js')
    assert.match(fabLayout, /2\.75rem/)
  })

  it('vehicle_year keeps raw digits while typing; clamps only on blur', () => {
    const schema = read('lib/config/category-form-schema.js')
    assert.match(schema, /key:\s*['\"]vehicle_year['\"][\s\S]*?yearBlur:\s*true[\s\S]*?optionalEmpty:\s*true/)

    const fields = read('components/partner/WizardSchemaFields.jsx')
    assert.match(fields, /field\.yearBlur/)
    assert.match(fields, /slice\(0,\s*4\)/)
    assert.match(fields, /keep raw digits while typing/)
  })
})
