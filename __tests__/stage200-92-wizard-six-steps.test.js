/**
 * Stage 200.92 — Listing wizard 6 steps (Calendar = 5, Preview = 6).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-92-wizard-six-steps.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.92 — six-step wizard wiring', () => {
  it('LISTING_WIZARD_STEP_COUNT is 6; slugs map calendar→5 preview→6', async () => {
    const constants = read('app/(partner)/partner/listings/new/wizard-constants.js')
    assert.match(constants, /LISTING_WIZARD_STEP_COUNT\s*=\s*6/)

    const {
      LISTING_WIZARD_STEP_SLUG_MAP,
      resolveListingWizardStepFromParam,
      listingWizardStepToSlug,
    } = await import('../lib/partner/listing-wizard-step-slugs.js')

    assert.equal(LISTING_WIZARD_STEP_SLUG_MAP.calendar, 5)
    assert.equal(LISTING_WIZARD_STEP_SLUG_MAP.preview, 6)
    assert.equal(resolveListingWizardStepFromParam('calendar'), 5)
    assert.equal(resolveListingWizardStepFromParam('preview'), 6)
    assert.equal(listingWizardStepToSlug(5), 'calendar')
    assert.equal(listingWizardStepToSlug(6), 'preview')
  })

  it('page mounts StepCalendar on 5 and StepPreview on 6; no global calendar tail', () => {
    const inner = read('app/(partner)/partner/listings/new/components/ListingWizardPageInner.jsx')
    assert.match(inner, /case 5:\s*return <StepCalendar/)
    assert.match(inner, /case 6:\s*return <StepPreview/)
    assert.doesNotMatch(inner, /isEditRoute &&[\s\S]*StepCalendarSection/)
    assert.match(inner, /setCurrentStep\(5\)/)
    assert.match(inner, /wizardStep_calendar/)
  })

  it('StepPricing has no DayPicker seasons; points to calendar step', () => {
    const src = read('app/(partner)/partner/listings/new/components/StepPricing.jsx')
    assert.doesNotMatch(src, /DayPicker/)
    assert.doesNotMatch(src, /getSeasonColor|SEASON_TYPES|newSeason/)
    assert.match(src, /wizardPricing_seasonsOnCalendarStep/)
    assert.match(src, /setCurrentStep\?\.\(5\)|setCurrentStep\(5\)/)
  })

  it('validation: step 5 optional; step 6 keeps preview gates', async () => {
    const { computeWizardStepBlockers } = await import(
      '../app/(partner)/partner/listings/new/hooks/listing-wizard-step-validation.js'
    )
    const empty = {
      title: '',
      description: '',
      categoryId: '',
      country: '',
      basePriceThb: '',
      images: [],
      latitude: null,
      longitude: null,
      metadata: {},
    }
    assert.equal(computeWizardStepBlockers(5, empty, true).length, 0)
    const previewBlockers = computeWizardStepBlockers(6, empty, true)
    assert.ok(previewBlockers.length > 0)
    assert.ok(previewBlockers.some((b) => b.field === 'title' || b.i18nKey?.includes('title')))
  })

  it('i18n keys present in ru/en/zh/th', () => {
    const src = read('lib/translations/listings-partner-wizard.js')
    for (const key of [
      'wizardStep_calendar',
      'wizardStep_calendarHint',
      'wizardStep_calendarNeedsDraft',
      'wizardPricing_seasonsOnCalendarStep',
      'wizardPricing_goToCalendarStep',
    ]) {
      const matches = src.match(new RegExp(`${key}:`, 'g'))
      assert.equal(matches?.length, 4, `${key} should appear in 4 locales`)
    }
  })
})
