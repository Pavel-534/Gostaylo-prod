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
  'calc_step_pool',
  'calc_split_l2',
  'calc_guest_body',
  'calc_result_l3_label',
]

describe('Stage 131.A5.B2 — calculator v2', () => {
  it('shared component: simple result + marketing detail without hold/FX noise', () => {
    const src = read('components/referral/ReferralCalculatorV2.jsx')
    assert.match(src, /data-testid="referral-calculator-v2"/)
    assert.match(src, /data-testid="calc-simple-result"/)
    assert.match(src, /data-testid="calc-total-amount"/)
    assert.match(src, /data-testid="calc-detail-panel"/)
    assert.match(src, /data-testid="calc-guest-panel"/)
    assert.match(src, /data-testid="calc-l3-locked"/)
    assert.match(src, /data-testid="calc-activity-presets"/)
    assert.match(src, /calc_guest_example_wallet/)
    assert.match(src, /calc_guest_example_pool/)
    assert.match(src, /calc_guest_footnote/)
    assert.doesNotMatch(src, /formatThbAsDisplay/)
    assert.doesNotMatch(src, /calc_fx_note/)
    assert.doesNotMatch(src, /calc_total_note/)
    assert.doesNotMatch(src, /calc_step2/)
    assert.doesNotMatch(src, /calc_step3/)
    assert.doesNotMatch(src, /referralReinvestmentPercent/)
    assert.doesNotMatch(src, /THB\/заказ|THB\/order/)
    assert.match(src, /CALC_AVG_MIN/)
    assert.match(src, /min=\{CALC_AVG_MIN\}/)
    assert.doesNotMatch(src, /поездка|бронь|жильё|путешественник|Apartment|traveler/i)
  })

  it('cabinet + public page wire the shared component', () => {
    const cabinet = read('components/referral/ReferralProfilePage.jsx')
    assert.match(cabinet, /ReferralCalculatorV2/)
    assert.match(cabinet, /directPartnersInvited/)
    assert.match(cabinet, /stage131a5_progressNextReward/)
    assert.match(cabinet, /tier: nextTierName/)
    assert.doesNotMatch(cabinet, /flex items-center justify-between gap-3[\s\S]{0,200}stage131a5_progressCurrent/)
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

  it('i18n calc_* keys exist for ru/en/zh/th; splits say “of the pool”', () => {
    const src = read('lib/translations/slices/profile-app-referral.js')
    for (const key of CALC_KEYS) {
      const matches = src.match(new RegExp(`${key}:`, 'g')) || []
      assert.equal(matches.length, 4, `${key} should exist in 4 locales, got ${matches.length}`)
    }
    assert.match(src, /calc_guest_body:[\s\S]*?\{brand\}/)
    assert.match(src, /% пула|of the pool|池的|ของพูล/)
    assert.match(src, /Примерная оценка|Approximate estimate|大致估算|ประมาณการตามกฎ/)
    assert.doesNotMatch(src, /calc_disclaimer:[\s\S]{0,120}холда 14|Hold 14|14 天保留|รอ 14 วัน/)
    assert.doesNotMatch(src, /calc_split_l2:[\s\S]{0,160}THB\/заказ|THB\/order|THB\/รายการ/)
    // Calculator marketing copy must not expose guest service-fee %.
    assert.doesNotMatch(src, /calc_step1_hint:\s*"[^"]*(?:сервисн|service fee|服务费|ค่าบริการ|15%)/)
    assert.doesNotMatch(src, /calc_step_pool_hint:\s*"[^"]*(?:сервисн|service fee|15%)/)
    assert.match(src, /calc_guest_example_wallet:[\s\S]*?% от пула|of the pool|池的|ของพูล/)
    assert.doesNotMatch(src, /stage131a5_progressNextReward:[\s\S]{0,80}бонус к L1|L1 bonus|\+\{pct\}% L1/)
    assert.match(src, /stage131a5_progressNextReward:[\s\S]*?вывести на карту|withdrawn to a card|提现到银行卡|ถอนเข้าบัตร/)
  })
})
