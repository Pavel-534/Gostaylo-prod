/**
 * Stage 200.28 — wizard quality gates + step blockers + vertical health.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-28-wizard-quality-ux.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.28 — publish gates (1 photo, desc = soft 40)', () => {
  it('exports photo min aligned with soft (1)', async () => {
    const g = await import('../lib/partner/listing-quality-gates.js')
    assert.equal(g.LISTING_QUALITY_MIN_PHOTOS, 1)
    assert.equal(g.LISTING_QUALITY_MIN_PHOTOS, g.LISTING_SOFT_MIN_PHOTOS)
    assert.equal(g.LISTING_QUALITY_MIN_DESCRIPTION, g.LISTING_SOFT_MIN_DESCRIPTION)
    assert.equal(g.LISTING_SOFT_MIN_DESCRIPTION, 40)
  })

  it('formats metadata checklist with human labels', async () => {
    const { formatListingQualityChecklistLabel } = await import(
      '../lib/partner/listing-quality-gates.js'
    )
    const t = (key, fb) =>
      ({
        listingQuality_metadataField: 'Заполните поле: {{field}}',
        fieldVehicleYear: 'Год выпуска',
        fieldVehicleSeats: 'Число мест',
      })[key] || fb
    const year = formatListingQualityChecklistLabel(
      { i18nKey: 'listingQuality_metadataField', params: { field: 'vehicle_year' } },
      t,
    )
    assert.match(year, /Год выпуска/)
    assert.doesNotMatch(year, /vehicle_year/)
  })
})

describe('Stage 200.28 — step blockers', () => {
  it('returns blockers when step fields missing', async () => {
    const { computeWizardStepBlockers, computeWizardCanProceed } = await import(
      '../app/(partner)/partner/listings/new/hooks/listing-wizard-step-validation.js'
    )
    const empty = computeWizardStepBlockers(1, {
      listingServiceType: '',
      categoryId: '',
      title: '',
      description: '',
    })
    assert.ok(empty.length >= 3)
    assert.equal(computeWizardCanProceed(1, { listingServiceType: '', categoryId: '', title: '', description: '' }, true), false)

    const ok = computeWizardStepBlockers(3, {
      images: ['a'],
    })
    assert.equal(ok.length, 0)
    assert.equal(computeWizardCanProceed(3, { images: ['a'] }, true), true)
  })

  it('UI shows WizardStepBlockersHint when Next blocked', () => {
    const actions = read(
      'app/(partner)/partner/listings/new/components/chrome/ListingWizardStepActions.jsx',
    )
    assert.match(actions, /WizardStepBlockersHint/)
    assert.match(actions, /stepBlockers/)
    assert.match(actions, /scrollWizardFieldIntoView/)
    assert.match(actions, /handleNextClick/)
    assert.ok(fs.existsSync(path.join(root, 'app/(partner)/partner/listings/new/components/chrome/WizardStepBlockersHint.jsx')))
  })
})

describe('Stage 200.29 — field error highlight', () => {
  it('blockers carry field keys and steps wire data-wizard-field', async () => {
    const { computeWizardStepBlockers, wizardStepFieldErrorsFromBlockers } = await import(
      '../app/(partner)/partner/listings/new/hooks/listing-wizard-step-validation.js'
    )
    const blockers = computeWizardStepBlockers(1, {
      listingServiceType: '',
      categoryId: '',
      title: '',
      description: '',
    })
    const errors = wizardStepFieldErrorsFromBlockers(blockers)
    assert.equal(errors.listingServiceType, true)
    assert.equal(errors.title, true)
    const general = read('app/(partner)/partner/listings/new/components/StepGeneralInfo.jsx')
    assert.match(general, /data-wizard-field="title"/)
    assert.match(general, /wizardFieldErrorClass/)
    const photos = read('app/(partner)/partner/listings/new/components/StepPhotos.jsx')
    assert.match(photos, /data-wizard-field="images"/)
  })
})

describe('Stage 200.28 — health mode for transport', () => {
  it('does not expose stay amenities/rules parts for transport', async () => {
    const { calculateListingHealthScore } = await import('../lib/partner/listing-health-score.js')
    const r = calculateListingHealthScore({
      wizardProfile: 'transport',
      images: ['1'],
      description: 'short',
    })
    assert.equal(r.mode, 'transport')
    const keys = r.parts.map((p) => p.key)
    assert.deepEqual(keys.sort(), ['description', 'features', 'photos', 'pickup'].sort())
  })
})
