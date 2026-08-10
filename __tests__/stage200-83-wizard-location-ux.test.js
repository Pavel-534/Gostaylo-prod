/**
 * Stage 200.83 — wizard location UX (region derived, Chita seed, district optional).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-83-wizard-location-ux.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.83 — RU seed Chita / Zabaykalsky', () => {
  it('seed includes RU-ZAB + chita', async () => {
    const { LAUNCH_GEO_SEED } = await import('@/lib/geo/launch-markets-seed-data.js')
    const { resetLaunchGeoIndexForTests } = await import('@/lib/geo/launch-geo-index.js')
    resetLaunchGeoIndexForTests()
    assert.ok(LAUNCH_GEO_SEED.some((n) => n.code === 'RU-ZAB'))
    assert.ok(LAUNCH_GEO_SEED.some((n) => n.code === 'chita' && n.parent_code === 'RU-ZAB'))
  })

  it('matchLaunchGeoByLabel resolves Чита → chita → RU-ZAB', async () => {
    const { matchLaunchGeoByLabel, resolveLaunchCityCascade, resetLaunchGeoIndexForTests } =
      await import('@/lib/geo/launch-geo-index.js')
    resetLaunchGeoIndexForTests()
    const city = matchLaunchGeoByLabel('Чита', { countryCode: 'RU', levels: ['city'] })
    assert.equal(city?.code, 'chita')
    const cascade = resolveLaunchCityCascade('chita')
    assert.equal(cascade?.region_code, 'RU-ZAB')
  })
})

describe('Stage 200.83 — cascade clears stale region', () => {
  it('unmatched city without regionCode clears previous hub region', async () => {
    const { applyWizardCityCascadeSelect } = await import('@/lib/geo/wizard-geo-cascade-reset.js')
    const next = applyWizardCityCascadeSelect(
      {
        country: 'RU',
        region: 'RU-KDA',
        city: '',
        metadata: { region_label: 'Краснодарский край' },
      },
      {
        cityCode: '',
        cityLabel: 'Чита',
        unmatched: true,
        clearPin: true,
        clearAddress: true,
      },
    )
    assert.equal(next.region, '')
    assert.equal(next.metadata.region_label, '')
  })

  it('catalog city sets Zabaykalsky region', async () => {
    const { applyWizardCityCascadeSelect } = await import('@/lib/geo/wizard-geo-cascade-reset.js')
    const next = applyWizardCityCascadeSelect(
      { country: 'RU', region: 'RU-KDA', metadata: {} },
      {
        cityCode: 'chita',
        cityLabel: 'Чита',
        regionCode: 'RU-ZAB',
        regionLabel: 'Забайкальский край',
      },
    )
    assert.equal(next.region, 'RU-ZAB')
    assert.equal(next.metadata.region_label, 'Забайкальский край')
  })
})

describe('Stage 200.83 — gates + UI wiring', () => {
  it('step 2 does not require district', async () => {
    const { computeWizardStepBlockers } = await import(
      '../app/(partner)/partner/listings/new/hooks/listing-wizard-step-validation.js'
    )
    const blockers = computeWizardStepBlockers(
      2,
      {
        country: 'RU',
        city: 'chita',
        district: '',
        latitude: 52.03,
        longitude: 113.5,
        metadata: { city_label: 'Чита' },
      },
      true,
    )
    assert.ok(!blockers.some((b) => b.field === 'district'))
  })

  it('soft publish does not require district', async () => {
    const { validateListingSoftPublishQuality } = await import(
      '../lib/partner/listing-quality-gates.js'
    )
    const soft = validateListingSoftPublishQuality({
      title: 'Villa',
      description: 'X'.repeat(40),
      images: ['https://example.com/1.jpg'],
      district: '',
      basePriceThb: 1500,
    })
    assert.equal(soft.ok, true)
    assert.ok(!soft.codes.includes('LISTING_DISTRICT_REQUIRED'))
  })

  it('StepLocation has no hub region Select; street typeahead present', () => {
    const src = read('app/(partner)/partner/listings/new/components/StepLocation.jsx')
    assert.doesNotMatch(src, /SelectTrigger/)
    assert.doesNotMatch(src, /wizardGeo_selectRegion/)
    assert.match(src, /WizardStreetTypeahead/)
    assert.match(src, /matchLaunchGeoByLabel/)
  })

  it('MapPicker hides lock until pin exists', () => {
    const src = read('components/listing/MapPicker.jsx')
    assert.match(src, /lockable && position/)
    assert.match(src, /mapPicker_hintPlaceExact/)
  })
})
