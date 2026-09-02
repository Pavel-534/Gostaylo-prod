/**
 * Stage 202.33 — UX quick wins + compliance copy.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage-202-33-ux-quick-wins.test.js
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { leaderRoadmapUi } from '@/lib/translations/slices/leader-roadmap.js'
import { referralDisclaimersUi } from '@/lib/translations/slices/referral-disclaimers.js'
import { profileAppReferralUi } from '@/lib/translations/slices/profile-app-referral.js'
import { LEADER_ROADMAP } from '@/lib/services/marketing/leader-roadmap.service.js'

const LANGS = ['ru', 'en', 'zh', 'th']

function read(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8')
}

describe('stage-202-33 ux quick wins', () => {
  it('loyalty step2 title does not embed welcomeAmount placeholder (no ₽0 headline)', () => {
    for (const lang of LANGS) {
      const title = profileAppReferralUi[lang].stage91_loyaltyStep2Title
      assert.ok(title, lang)
      assert.doesNotMatch(title, /\{welcomeAmount\}/)
      assert.doesNotMatch(title, /₽0|0\s*₽|0\s*руб/i)
    }
  })

  it('AboutLoyaltyClient does not pass welcomeAmount into step2 title key', () => {
    const src = read('components/about/AboutLoyaltyClient.jsx')
    assert.doesNotMatch(src, /stage91_loyaltyStep2Title.*welcomeAmount/)
    assert.match(src, /isZeroOrPlaceholderDisplay/)
  })

  it('leader roadmap L3 titles do not contain live marker', () => {
    for (const lang of LANGS) {
      const title = leaderRoadmapUi[lang].leaderRoadmap_item1_title
      assert.ok(title, lang)
      assert.doesNotMatch(title, /\(live\)/i)
      assert.doesNotMatch(title, /\blive\b/i)
    }
  })

  it('verified-by roadmap item removed from service SSOT list', () => {
    const ids = LEADER_ROADMAP.map((row) => row.id)
    assert.doesNotMatch(ids.join(','), /verified_by/)
    for (const lang of LANGS) {
      assert.equal(leaderRoadmapUi[lang].leaderRoadmap_item3_title, undefined)
    }
  })

  it('TierRoadmap has lock tooltip for squad quests', () => {
    const src = read('components/referral/TierRoadmap.jsx')
    assert.match(src, /leaderRoadmap_squadQuestsLockTooltip/)
    assert.match(src, /leader-roadmap-lock-/)
  })

  it('QuestsBlock keeps promo-budget disclaimer from 202.29b', () => {
    const src = read('components/referral/QuestsBlock.jsx')
    assert.match(src, /leaderQuests_disclaimer/)
  })

  it('HostReferralCard exists with disclosure, promo note, and no-agency copy', () => {
    const src = read('components/referral/HostReferralCard.jsx')
    assert.match(src, /hostReferralDisclosure/)
    assert.match(src, /noAgencyRelationship/)
    assert.match(src, /partnerActivationBonusThb|partner_activation_bonus/)
    assert.match(src, /ReferralLedgerAmount/)
    assert.match(src, /data-testid="host-referral-card"/)
    assert.match(src, /hostReferralCard_withdrawHint/)
    assert.doesNotMatch(src, /реферал получит/)
  })

  it('referral-disclaimers.js has 4 languages for compliance keys', () => {
    const keys = [
      'hostReferralDisclosure',
      'taxResponsibility',
      'referralInviteLimit',
      'noAgencyRelationship',
    ]
    for (const lang of LANGS) {
      for (const key of keys) {
        const val = referralDisclaimersUi[lang]?.[key]
        assert.ok(val && String(val).trim(), `${lang}.${key}`)
      }
    }
  })

  it('referral invite limit copy uses monthly limit placeholder, not 50/year fiction', () => {
    for (const lang of LANGS) {
      const text = referralDisclaimersUi[lang].referralInviteLimit
      assert.match(text, /\{limit\}/)
      assert.doesNotMatch(text, /50/)
      assert.doesNotMatch(text, /year|год|年|ปี/i)
    }
  })

  it('ReferralLegalFootnotes collapsible mounted on earnings tab', () => {
    const src = read('components/referral/ReferralProfileTabEarnings.jsx')
    assert.match(src, /ReferralLegalFootnotes/)
    assert.match(src, /referralMonthlyLimitPerUser/)
  })

  it('referral/me exposes policy fields for host card + legal footnotes', () => {
    const src = read('app/api/v2/referral/me/route.js')
    assert.match(src, /partnerActivationBonusThb/)
    assert.match(src, /mlmLevel1Percent/)
    assert.match(src, /referralMonthlyLimitPerUser/)
  })

  it('HostReferralCard mounted on link tab', () => {
    const src = read('components/referral/ReferralProfileTabLink.jsx')
    assert.match(src, /HostReferralCard/)
  })
})
