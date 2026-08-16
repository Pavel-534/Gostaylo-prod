/**
 * Stage 201.61 — vehicle wizard copy (no Airbnb/iCal/FX noise) + draft/publish spinner split.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-61-vehicle-wizard-copy-spinners.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.61 — vehicle wizard copy + last-step spinners', () => {
  it('vehicle calendar / instant-booking copy has no Airbnb Booking iCal', () => {
    const i18n = read('lib/translations/listings-partner-wizard.js')
    assert.match(i18n, /wizardStep_calendarHintVehicle/)
    assert.match(i18n, /partnerListing_instantBookingHintVehicle/)
    assert.match(i18n, /partnerListing_exclusiveCalendarHintVehicle/)
    const vehicleHint = i18n.match(
      /wizardStep_calendarHintVehicle:\s*\n?\s*"([^"]+)"/,
    )
    assert.ok(vehicleHint)
    assert.doesNotMatch(vehicleHint[1], /Airbnb|Booking|iCal/i)

    const cal = read('lib/translations/listings-partner-calendar.js')
    const body = cal.match(/partnerCal_eduVehicleBody:\s*"([^"]+)"/)
    assert.ok(body)
    assert.doesNotMatch(body[1], /Airbnb|Booking/i)

    const pricing = read(
      'app/(partner)/partner/listings/new/components/StepPricing.jsx',
    )
    assert.doesNotMatch(pricing, /wizardBaseCurrencyFxHint/)
    assert.match(pricing, /partnerListing_instantBookingHintVehicle/)
  })

  it('last-step draft and publish spin independently', () => {
    const actions = read(
      'app/(partner)/partner/listings/new/components/chrome/ListingWizardStepActions.jsx',
    )
    assert.match(actions, /draftBusy/)
    assert.match(actions, /publishBusy/)
    assert.match(actions, /\{draftBusy \?/)
    assert.match(actions, /\{publishBusy \?/)
    assert.doesNotMatch(actions, /lastStepBusy \? \(\s*\n?\s*<Loader2/)
  })
})
