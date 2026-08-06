/**
 * Stage 200.46 — pin/country conflict + city blur commit wiring.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-46-pin-country-conflict.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.46 — detectPinCountryConflict', () => {
  it('flags TH pin vs RU country; dismiss clears block', async () => {
    const { detectPinCountryConflict, clearWizardFormPin } = await import(
      '../lib/geo/wizard-pin-country-conflict.js'
    )
    const conflict = detectPinCountryConflict({
      country: 'RU',
      lat: 7.88,
      lon: 98.39,
      pinCountryCode: 'TH',
    })
    assert.equal(conflict.conflict, true)
    assert.equal(conflict.blocked, true)
    assert.equal(conflict.pinCountry, 'TH')

    const dismissed = detectPinCountryConflict({
      country: 'RU',
      lat: 7.88,
      lon: 98.39,
      pinCountryCode: 'TH',
      dismissed: true,
    })
    assert.equal(dismissed.conflict, true)
    assert.equal(dismissed.blocked, false)

    const ok = detectPinCountryConflict({
      country: 'RU',
      lat: 59.93,
      lon: 30.36,
      pinCountryCode: 'RU',
    })
    assert.equal(ok.conflict, false)
    assert.equal(ok.blocked, false)

    const cleared = clearWizardFormPin(
      {
        latitude: 7.88,
        longitude: 98.39,
        metadata: { geo_pin_country: 'TH', timezone: 'Asia/Bangkok' },
      },
      { timezone: 'Europe/Moscow' },
    )
    assert.equal(cleared.latitude, null)
    assert.equal(cleared.longitude, null)
    assert.equal(cleared.metadata.timezone, 'Europe/Moscow')
    assert.equal(cleared.metadata.geo_pin_country, undefined)
  })

  it('infers pin country from launch bbox when meta missing', async () => {
    const { detectPinCountryConflict } = await import('../lib/geo/wizard-pin-country-conflict.js')
    const r = detectPinCountryConflict({
      country: 'TH',
      lat: 55.75,
      lon: 37.62,
    })
    assert.equal(r.conflict, true)
    assert.equal(r.pinCountry, 'RU')
  })
})

describe('Stage 200.46 — blockers + UI wiring', () => {
  it('step validation blocks Next on unresolved conflict', async () => {
    const { computeWizardStepBlockers } = await import(
      '../app/(partner)/partner/listings/new/hooks/listing-wizard-step-validation.js'
    )
    const blockers = computeWizardStepBlockers(2, {
      country: 'RU',
      latitude: 7.88,
      longitude: 98.39,
      city: 'spb',
      district: 'Центр',
      metadata: { geo_pin_country: 'TH', city_label: 'Phuket' },
    })
    assert.ok(blockers.some((b) => b.i18nKey === 'wizardBlocker_pinCountryConflict'))

    const ok = computeWizardStepBlockers(2, {
      country: 'RU',
      latitude: 7.88,
      longitude: 98.39,
      city: 'spb',
      district: 'Центр',
      metadata: {
        geo_pin_country: 'TH',
        geo_pin_country_conflict_dismissed: true,
        city_label: 'Phuket',
      },
    })
    assert.ok(!ok.some((b) => b.i18nKey === 'wizardBlocker_pinCountryConflict'))
  })

  it('WizardCityTypeahead commits on blur/Enter', () => {
    const src = read('app/(partner)/partner/listings/new/components/WizardCityTypeahead.jsx')
    assert.match(src, /onBlur/)
    assert.match(src, /commitFromQuery/)
    assert.match(src, /Enter/)
    assert.match(src, /onClear/)
  })

  it('StepLocation wires conflict CTAs and merge SSOT', () => {
    const src = read('app/(partner)/partner/listings/new/components/StepLocation.jsx')
    assert.match(src, /detectPinCountryConflict/)
    assert.match(src, /handlePinConflictKeepCountry/)
    assert.match(src, /handlePinConflictUseMap/)
    assert.match(src, /handlePinConflictDismiss/)
    assert.match(src, /clearWizardFormPin/)
    assert.match(src, /geo_pin_country/)
  })

  it('merge stores geo_pin_country', () => {
    const src = read('lib/geo/wizard-geo-from-pin.js')
    assert.match(src, /geo_pin_country/)
    assert.match(src, /geo_pin_country_conflict_dismissed/)
  })
})
