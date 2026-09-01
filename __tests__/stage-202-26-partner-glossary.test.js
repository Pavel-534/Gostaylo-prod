/**
 * Stage 202.26 — partner metrics glossary + UI disambiguation.
 * Run:
 *   node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage-202-26-partner-glossary.test.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const {
  REFERRAL_GLOSSARY,
  PARTNER_METRICS_AXES,
  isValidPartnerMetricsAxis,
} = require('../lib/referral/partner-metrics-glossary.js')
const { referralGlossaryUi } = require('../lib/translations/slices/referral-glossary.js')

function read(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8')
}

describe('Stage 202.26 — REFERRAL_GLOSSARY SSOT', () => {
  it('defines 4 metric axes with term/definition/example keys', () => {
    assert.equal(Object.keys(REFERRAL_GLOSSARY).length, 4)
    for (const entry of Object.values(REFERRAL_GLOSSARY)) {
      assert.ok(entry.termKey)
      assert.ok(entry.definitionKey)
      assert.ok(entry.exampleKey)
      assert.ok(entry.subtitleKey)
      assert.ok(isValidPartnerMetricsAxis(entry.axis))
    }
  })

  it('all 4 languages include every glossary key', () => {
    const requiredKeys = new Set()
    for (const entry of Object.values(REFERRAL_GLOSSARY)) {
      requiredKeys.add(entry.termKey)
      requiredKeys.add(entry.definitionKey)
      requiredKeys.add(entry.exampleKey)
      requiredKeys.add(entry.subtitleKey)
    }
    requiredKeys.add('referralGlossary_tooltipAria')
    for (const lang of ['ru', 'en', 'zh', 'th']) {
      const slice = referralGlossaryUi[lang] || {}
      for (const key of requiredKeys) {
        assert.ok(slice[key], `missing ${lang}.${key}`)
      }
    }
  })
})

describe('Stage 202.26 — component wiring', () => {
  it('PartnerMetricsTooltip uses HelpCircle and REFERRAL_GLOSSARY', () => {
    const src = read('components/referral/PartnerMetricsTooltip.jsx')
    assert.match(src, /HelpCircle/)
    assert.match(src, /REFERRAL_GLOSSARY/)
    assert.doesNotMatch(src, /\.module\.css/)
  })

  it('ReferralTeamMetricsStrip mounts l1_invites + withdraw_tier tooltips', () => {
    const src = read('components/referral/ReferralTeamMetricsStrip.jsx')
    assert.match(src, /PartnerMetricsTooltip/)
    assert.match(src, /L1_INVITES/)
    assert.match(src, /WITHDRAW_TIER/)
    assert.doesNotMatch(src, /завершённой бронью/)
    assert.doesNotMatch(src, /бронь/)
  })

  it('LocalLeaderTier uses community_qualified axis', () => {
    const src = read('components/referral/LocalLeaderTier.jsx')
    assert.match(src, /COMMUNITY_QUALIFIED/)
  })

  it('ReferralAmbassadorLevels uses withdraw_tier axis (same counter as payout %)', () => {
    const src = read('components/referral/ReferralAmbassadorLevels.jsx')
    assert.match(src, /WITHDRAW_TIER/)
  })

  it('ReferralProfilePage tier ladder uses withdraw_tier glossary', () => {
    const src = read('components/referral/ReferralProfilePage.jsx')
    assert.match(src, /WITHDRAW_TIER/)
  })

  it('ReferralTeamAnalyticsCard analytics header uses network_earnings axis', () => {
    const src = read('components/referral/ReferralTeamAnalyticsCard.jsx')
    assert.match(src, /NETWORK_EARNINGS/)
  })
})

describe('Stage 202.26 — axis constants', () => {
  it('PARTNER_METRICS_AXES matches glossary keys', () => {
    assert.equal(PARTNER_METRICS_AXES.L1_INVITES, 'l1_invites')
    assert.equal(PARTNER_METRICS_AXES.WITHDRAW_TIER, 'withdraw_tier')
    assert.equal(PARTNER_METRICS_AXES.NETWORK_EARNINGS, 'network_earnings')
    assert.equal(PARTNER_METRICS_AXES.COMMUNITY_QUALIFIED, 'community_qualified')
  })
})
