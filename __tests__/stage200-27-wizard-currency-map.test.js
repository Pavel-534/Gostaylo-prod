/**
 * Stage 200.27 — wizard currency labels SSOT + map height restore.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-27-wizard-currency-map.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.27 — pricing labels follow baseCurrency (no hardcoded ฿)', () => {
  it('i18n basePrice* use {{unit}}/{{currency}} placeholders', () => {
    const src = read('lib/translations/listings-partner-wizard.js')
    assert.match(src, /basePrice:\s*"Базовая цена \(\{\{unit\}\}\) \*"/)
    assert.match(src, /basePriceVehicle:\s*"Базовая цена \(\{\{unit\}\}\) \*"/)
    assert.ok(src.includes('{{currency}}'))
    assert.ok(src.includes('basePriceTour:'))
    assert.doesNotMatch(src, /Базовая цена \(฿/)
    assert.doesNotMatch(src, /Base Price \(THB\/night\)/)
  })

  it('StepPricing uses getCurrencySymbol + tr placeholders', () => {
    const src = read('app/(partner)/partner/listings/new/components/StepPricing.jsx')
    assert.match(src, /getCurrencySymbol/)
    assert.match(src, /tr\('basePrice/)
    assert.match(src, /basePriceLabel/)
  })
})

describe('Stage 200.27 — MapPicker height + country center', () => {
  it('StepLocation passes numeric height (not % inside fixed wrapper)', () => {
    const src = read('app/(partner)/partner/listings/new/components/StepLocation.jsx')
    assert.match(src, /height=\{280\}/)
    assert.doesNotMatch(src, /h-\[280px\].*MapPicker|MapPicker[\s\S]*height="100%"/)
    assert.match(src, /defaultTimezoneForCountryCode/)
    assert.match(src, /countryCode=\{formData\.country\}/)
  })

  it('MapPicker has country default centers', () => {
    const src = read('components/listing/MapPicker.jsx')
    assert.match(src, /COUNTRY_MAP_CENTERS/)
    assert.match(src, /countryCode/)
    assert.match(src, /RU:\s*\[55\.7558/)
  })

  it('Russia pin guess returns Europe/Moscow', () => {
    const { guessIanaTimezoneFromLatLon } = require('../lib/geo/listing-timezone-guess.js')
    assert.equal(guessIanaTimezoneFromLatLon(55.75, 37.62), 'Europe/Moscow')
  })
})
