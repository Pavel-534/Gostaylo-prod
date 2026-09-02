/**
 * Stage 202.37 — Host-side economy UI (journey + compliance deepening).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage-202-37-host-economy-ui.test.js
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { hostReferralJourneyUi } from '@/lib/translations/slices/host-referral-journey.js'
import { referralDisclaimersUi } from '@/lib/translations/slices/referral-disclaimers.js'

const LANGS = ['ru', 'en', 'zh', 'th']

function read(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8')
}

describe('stage-202-37 host economy ui', () => {
  it('HostReferralJourney mounted on link tab under HostReferralCard', () => {
    const src = read('components/referral/ReferralProfileTabLink.jsx')
    const cardIdx = src.indexOf('<HostReferralCard')
    const journeyIdx = src.indexOf('<HostReferralJourney')
    assert.ok(cardIdx >= 0)
    assert.ok(journeyIdx > cardIdx)
  })

  it('journey has step1-step4 keys in all 4 languages', () => {
    const keys = [
      'hostReferralJourney_step1Title',
      'hostReferralJourney_step1Body',
      'hostReferralJourney_step2Title',
      'hostReferralJourney_step2Body',
      'hostReferralJourney_step3Title',
      'hostReferralJourney_step3Body',
      'hostReferralJourney_step4Title',
      'hostReferralJourney_step4Body',
    ]
    for (const lang of LANGS) {
      for (const key of keys) {
        assert.ok(hostReferralJourneyUi[lang]?.[key], `${lang}.${key}`)
      }
    }
  })

  it('example uses mlmLevel1Percent axis, not guest pool L1 (42%)', () => {
    const cardSrc = read('components/referral/HostReferralCard.jsx')
    assert.match(cardSrc, /mlmLevel1Percent|mlm_level1_percent/)
    assert.doesNotMatch(cardSrc, /ambassadorGuestPoolL1Percent/)
    for (const lang of LANGS) {
      const example = referralDisclaimersUi[lang].hostReferralCard_example
      assert.doesNotMatch(example, /42/)
      assert.doesNotMatch(example, /5000/)
    }
  })

  it('journey step4 does not promise ongoing % of every host booking', () => {
    for (const lang of LANGS) {
      const body = hostReferralJourneyUi[lang].hostReferralJourney_step4Body
      assert.doesNotMatch(body, /каждой брон/i)
      assert.doesNotMatch(body, /every booking/i)
      assert.doesNotMatch(body, /5000/)
      assert.doesNotMatch(body, /70%/)
    }
  })

  it('ReferralLegalFootnotes includes host disclosure and anti-spam', () => {
    const src = read('components/referral/ReferralLegalFootnotes.jsx')
    assert.match(src, /hostReferralDisclosure/)
    assert.match(src, /referralAntiSpam/)
    assert.match(src, /referralNoSocialHousing/)
    assert.match(src, /referralNoPaidPromotion/)
  })

  it('referral-disclaimers compliance keys exist in all 4 languages', () => {
    const keys = ['referralAntiSpam', 'referralNoSocialHousing', 'referralNoPaidPromotion']
    for (const lang of LANGS) {
      for (const key of keys) {
        assert.ok(referralDisclaimersUi[lang]?.[key], `${lang}.${key}`)
      }
    }
  })

  it('per-user cap uses {limit} placeholder from SSOT', () => {
    for (const lang of LANGS) {
      assert.match(referralDisclaimersUi[lang].referralInviteLimit, /\{limit\}/)
    }
    const src = read('components/referral/ReferralLegalFootnotes.jsx')
    assert.match(src, /referralMonthlyLimitPerUser|monthlyInviteLimit/)
  })

  it('i18n slices have no hardcoded THB amounts in journey copy', () => {
    for (const lang of LANGS) {
      for (const val of Object.values(hostReferralJourneyUi[lang] || {})) {
        assert.doesNotMatch(String(val), /\b500\s*THB\b/i)
        assert.doesNotMatch(String(val), /\b5000\b/)
      }
    }
  })

  it('HostReferralJourney is collapsible and vertical stack', () => {
    const src = read('components/referral/HostReferralJourney.jsx')
    assert.match(src, /host-referral-journey-toggle/)
    assert.match(src, /useState\(false\)/)
    assert.doesNotMatch(src, /grid-cols/)
  })

  it('HostReferralCard has example disclaimer', () => {
    const src = read('components/referral/HostReferralCard.jsx')
    assert.match(src, /hostReferralCard_exampleDisclaimer/)
  })
})
