/**
 * Stage 200.48 — wiring checks for wizard geo e2e (no Playwright runtime).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-48-wizard-geo-e2e-wiring.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.48 — wizard geo e2e wiring', () => {
  it('typeaheads and FX strip expose stable testids', () => {
    const country = read(
      'app/(partner)/partner/listings/new/components/WizardCountryTypeahead.jsx',
    )
    const city = read('app/(partner)/partner/listings/new/components/WizardCityTypeahead.jsx')
    const step = read('app/(partner)/partner/listings/new/components/StepLocation.jsx')
    assert.match(country, /data-testid="wizard-country-typeahead"/)
    assert.match(country, /wizard-country-option-\$\{row\.code\}/)
    assert.match(city, /data-testid="wizard-city-typeahead"/)
    assert.match(city, /wizard-city-manual-option/)
    assert.match(step, /data-testid="wizard-geo-fx-strip"/)
    assert.match(step, /data-testid="wizard-geo-non-launch-banner"/)
    assert.match(step, /data-testid="wizard-district-input"/)
  })

  it('Playwright project + spec cover DE / TH-RU / mobile', () => {
    const cfg = read('playwright.config.ts')
    const spec = read('tests/e2e/wizard-geo-location.spec.ts')
    assert.match(cfg, /name: 'wizard-geo-location'/)
    assert.match(cfg, /wizard-geo-location\.spec\.ts/)
    assert.match(spec, /Stage 200\.48/)
    assert.match(spec, /data-currency', 'EUR'/)
    assert.match(spec, /data-currency', 'THB'/)
    assert.match(spec, /data-currency', 'RUB'/)
    assert.match(spec, /375.*812|setViewportSize\(\{ width: 375/)
    assert.match(spec, /\[E2E_TEST_DATA\]/)
  })

  it('country map viewport + listing GET expose geo codes', () => {
    const viewport = read('lib/geo/country-map-viewport.js')
    const getRoute = read('app/api/v2/partner/listings/[id]/route.js')
    const load = read(
      'app/(partner)/partner/listings/new/hooks/listing-wizard-load-existing.js',
    )
    assert.match(viewport, /DE: \[52\.52/)
    assert.match(getRoute, /countryCode: listing\.country_code/)
    assert.match(load, /listing\.countryCode/)
  })
})
