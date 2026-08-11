/**
 * Stage 200.99 — stay arrival hours (informational early/late on request).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-99-stay-arrival-hours.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.99 — stay arrival hours', () => {
  it('normalizes HH:mm and reads soft flexibility flags', async () => {
    const {
      normalizeArrivalTime,
      readStayArrivalFromMetadata,
    } = await import('@/lib/listing/stay-arrival-hours.js')
    assert.equal(normalizeArrivalTime('15:00'), '15:00')
    assert.equal(normalizeArrivalTime('15:01'), '')
    assert.equal(normalizeArrivalTime(''), '')
    const a = readStayArrivalFromMetadata({
      check_in_time: '15:00',
      check_out_time: '11:00',
      early_check_in_on_request: true,
      late_check_out_on_request: false,
    })
    assert.equal(a.checkInTime, '15:00')
    assert.equal(a.checkOutTime, '11:00')
    assert.equal(a.earlyCheckInOnRequest, true)
    assert.equal(a.lateCheckOutOnRequest, false)
  })

  it('listing-good-to-know source includes flexibility fields', () => {
    const src = read('lib/listing/listing-good-to-know.js')
    assert.match(src, /early_check_in_on_request/)
    assert.match(src, /hasFlexibility/)
    assert.match(src, /late_check_out_on_request/)
  })

  it('wizard + whitelist + PDP wired', () => {
    const schema = read('lib/config/category-form-schema.js')
    assert.match(schema, /check_in_time/)
    assert.match(schema, /early_check_in_on_request/)
    const basics = read('app/(partner)/partner/listings/new/components/StepGeneralInfo.jsx')
    assert.match(basics, /WizardStayArrivalHours/)
    assert.match(basics, /isStayService/)
    const stay = read(
      'app/(partner)/partner/listings/new/components/WizardStayArrivalHours.jsx',
    )
    assert.match(stay, /wizard-stay-arrival-hours/)
    const pdp = read('components/listing/ListingStayPolicies.jsx')
    assert.match(pdp, /listing-arrival-flexibility/)
    const wizI18n = read('lib/translations/listings-partner-wizard.js')
    assert.equal((wizI18n.match(/wizardArrival_sectionTitle:/g) || []).length, 4)
  })
})
