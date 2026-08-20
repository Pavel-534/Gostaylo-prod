/**
 * Stage 131.A5.B2 — calculator v2 (Variant B) contract tests.
 * Run:
 *   node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage131-a5-b2-calculator.test.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

function read(relPath) {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf8')
}

const CALC_KEYS = [
  'calc_simple_title',
  'calc_slider3_help',
  'calc_result_title',
  'calc_l3_locked_public',
  'calc_btn_how',
  'calc_btn_guest',
  'calc_fx_note',
  'calc_split_l2',
  'calc_guest_body',
  'calc_result_l3_label',
]

describe('Stage 131.A5.B2 — calculator v2', () => {
  it('shared component: simple result + detail/guest panels + activity presets', () => {
    const src = read('components/referral/ReferralCalculatorV2.jsx')
    assert.match(src, /data-testid="referral-calculator-v2"/)
    assert.match(src, /data-testid="calc-simple-result"/)
    assert.match(src, /data-testid="calc-total-amount"/)
    assert.match(src, /data-testid="calc-detail-panel"/)
    assert.match(src, /data-testid="calc-guest-panel"/)
    assert.match(src, /data-testid="calc-l3-locked"/)
    assert.match(src, /data-testid="calc-activity-presets"/)
    assert.match(src, /ACTIVITY_PRESETS/)
    assert.match(src, /l2ConversionRate/)
    assert.match(src, /directPartnersInvited/)
    assert.match(src, /calc_fx_note/)
    assert.match(src, /capBooking/)
    // Percents come from API splitPercents, not hardcoded 42/10/5 in payout math.
    assert.doesNotMatch(src, /splitPercents\?\.l1 \?\? 42/)
    assert.doesNotMatch(src, /splitPercents\?\.l2 \?\? 10/)
    // Housing-only terminology must not appear in new calculator UI copy keys usage.
    assert.doesNotMatch(src, /поездка|бронь|жильё|путешественник|Apartment|traveler/i)
  })

  it('cabinet + public page wire the shared component', () => {
    const cabinet = read('components/referral/ReferralProfilePage.jsx')
    assert.match(cabinet, /ReferralCalculatorV2/)
    assert.match(cabinet, /directPartnersInvited/)
    assert.doesNotMatch(cabinet, /stage131a5_calcFriendsLabel/)
    assert.doesNotMatch(cabinet, /setCalcOpen/)

    const about = read('components/about/ReferralCalculatorClient.jsx')
    assert.match(about, /ReferralCalculatorV2/)
    assert.doesNotMatch(about, /l1BookingsArr/)
  })

  it('route accepts l1ActivityRate alias into l2ConversionRate', () => {
    const src = read('app/api/v2/referral/calculator/route.js')
    assert.match(src, /l1ActivityRate/)
    assert.match(src, /l2ConversionRate/)
  })

  it('service exposes funnel + caps + conversion without changing split math surface', () => {
    const src = read('lib/services/marketing/referral-public-calculator.service.js')
    assert.match(src, /referralPoolThb/)
    assert.match(src, /platformGrossThb/)
    assert.match(src, /l2CapPerBookingThb/)
    assert.match(src, /l2CapPerMonthThb/)
    assert.match(src, /l3MinDirectPartners/)
    assert.match(src, /l2ConversionRate/)
    assert.match(src, /splitPoolForMarketing/)
  })

  it('i18n calc_* keys exist for ru/en/zh/th with brand placeholder', () => {
    const src = read('lib/translations/slices/profile-app-referral.js')
    for (const lang of ['ru:', 'en:', 'zh:', 'th:']) {
      assert.match(src, new RegExp(`\\b${lang}`))
    }
    for (const key of CALC_KEYS) {
      const re = new RegExp(`${key}:`)
      const matches = src.match(new RegExp(`${key}:`, 'g')) || []
      assert.equal(matches.length, 4, `${key} should exist in 4 locales, got ${matches.length}`)
      assert.match(src, re)
    }
    assert.match(src, /calc_guest_body:[\s\S]*?\{brand\}/)
    assert.match(src, /calc_slider3_help:[\s\S]*?протекают|flow deeper|更深|ไหลลึก/)
    // Activity help must not claim “% of invitees who book”.
    assert.doesNotMatch(src, /calc_slider3_help:[\s\S]{0,200}процент приглашённых|percent of invitees/)
  })
})
