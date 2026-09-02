/**
 * Stage 202.39 — Referral map UX (two earn paths, one link; UI-only).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage-202-39-referral-map-ux.test.js
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { referralEarnPathsUi } from '@/lib/translations/slices/referral-earn-paths.js'
import { hostReferralJourneyUi } from '@/lib/translations/slices/host-referral-journey.js'
import { leaderQuestsUi } from '@/lib/translations/slices/leader-quests.js'

const LANGS = ['ru', 'en', 'zh', 'th']

function read(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8')
}

describe('stage-202-39 referral map ux', () => {
  it('overview order: hero → earn paths → share → newcomer → calculator', () => {
    const src = read('components/referral/ReferralProfilePage.jsx')
    const hero = src.indexOf('stage131a5_heroWelcomeTitle')
    const paths = src.indexOf('<ReferralEarnPathsCard')
    const share = src.indexOf('data-testid="referral-hero-share-cta"')
    const newcomer = src.indexOf('<ReferralNewcomerSteps')
    const calc = src.indexOf('showContextCopy')
    assert.ok(hero >= 0 && paths > hero && share > paths && newcomer > share && calc > newcomer)
  })

  it('ReferralEarnPathsCard and newcomer steps exist with i18n keys', () => {
    assert.ok(fs.existsSync('components/referral/ReferralEarnPathsCard.jsx'))
    assert.ok(fs.existsSync('components/referral/ReferralNewcomerSteps.jsx'))
    const keys = [
      'referralEarnPaths_title',
      'referralEarnPaths_oneLink',
      'referralNewcomer_step1',
      'referralCalc_contextTitle',
    ]
    for (const lang of LANGS) {
      for (const key of keys) {
        assert.ok(referralEarnPathsUi[lang]?.[key], `${lang}.${key}`)
      }
    }
  })

  it('link tab: H1, lane chips, guest one-liner, journey after QR', () => {
    const src = read('components/referral/ReferralProfileTabLink.jsx')
    assert.match(src, /referralLink_pageTitle/)
    assert.match(src, /referral-link-lane-chips/)
    assert.match(src, /referral-link-guest-oneliner/)
    const qrIdx = src.indexOf('referral-link-qr')
    const journeyIdx = src.indexOf('<HostReferralJourney')
    assert.ok(qrIdx >= 0 && journeyIdx > qrIdx)
  })

  it('HostReferralJourney has guest + partner sections', () => {
    const src = read('components/referral/HostReferralJourney.jsx')
    assert.match(src, /host-referral-journey-guest-section/)
    assert.match(src, /host-referral-journey-partner-section/)
    for (const lang of LANGS) {
      assert.ok(hostReferralJourneyUi[lang]?.hostReferralJourney_guestSectionTitle, lang)
      assert.ok(hostReferralJourneyUi[lang]?.hostReferralJourney_partnerSectionTitle, lang)
    }
  })

  it('QuestsBlock groups guest vs partner quest ids', () => {
    const src = read('components/referral/QuestsBlock.jsx')
    assert.match(src, /first_invite/)
    assert.match(src, /three_hosts_30d/)
    assert.match(src, /leaderQuests_groupGuests/)
    assert.match(src, /leaderQuests_groupPartners/)
    for (const lang of LANGS) {
      assert.ok(leaderQuestsUi[lang]?.leaderQuests_groupGuests, lang)
      assert.ok(leaderQuestsUi[lang]?.leaderQuests_groupPartners, lang)
    }
  })

  it('engagement section shows optional hint, not required for basic invites', () => {
    const src = read('components/referral/ReferralLeaderEngagementSection.jsx')
    assert.match(src, /referralEngagement_optionalHint/)
  })

  it('no payout / ledger / API changes in stage files', () => {
    const touched = [
      'components/referral/ReferralProfilePage.jsx',
      'components/referral/ReferralEarnPathsCard.jsx',
      'lib/translations/slices/referral-earn-paths.js',
    ]
    for (const rel of touched) {
      const src = read(rel)
      assert.doesNotMatch(src, /referral-payout/)
      assert.doesNotMatch(src, /ledger-shadow/)
    }
  })
})
