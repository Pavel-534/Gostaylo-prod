/**
 * Stage 202.40 — Host activation 100% L1 + pot 760 THB + honest copy.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage-202-40-host-activation-l1.test.js
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { FINTECH_CONFIG_DEFAULTS } from '@/lib/config/fintech-config-defaults.js'
import { referralDisclaimersUi } from '@/lib/translations/slices/referral-disclaimers.js'
import { referralEarnPathsUi } from '@/lib/translations/slices/referral-earn-paths.js'
import { hostReferralJourneyUi } from '@/lib/translations/slices/host-referral-journey.js'

const LANGS = ['ru', 'en', 'zh', 'th']

function read(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8')
}

describe('stage-202-40 host activation L1 full', () => {
  it('defaults: pot 760 THB, mlm L1=100 L2=0', () => {
    assert.equal(FINTECH_CONFIG_DEFAULTS.partner_activation_bonus_thb, 760)
    assert.equal(FINTECH_CONFIG_DEFAULTS.mlm_level1_percent, 100)
    assert.equal(FINTECH_CONFIG_DEFAULTS.mlm_level2_percent, 0)
  })

  it('migration updates live system_fintech_settings global row', () => {
    const sql = read('migrations/stage202_40_host_activation_l1_full.sql')
    assert.match(sql, /partner_activation_bonus_thb\s*=\s*760/)
    assert.match(sql, /mlm_level1_percent\s*=\s*100/)
    assert.match(sql, /mlm_level2_percent\s*=\s*0/)
    assert.match(sql, /WHERE id = 'global'/)
  })

  it('distributeHostPartnerActivation skips L2 when mlmL2 is 0', () => {
    const src = read('lib/services/marketing/referral-payout.service.js')
    assert.match(src, /mlmL2 > 0 && level2Candidate/)
    assert.match(src, /Stage 202\.40/)
  })

  it('copy: you earn ~amount; no host-gets-activation-on-start; no literal 2500/1300', () => {
    for (const lang of LANGS) {
      const sub = referralDisclaimersUi[lang].hostReferralCard_subtitle
      assert.match(sub, /__ACTIVATION__/)
      assert.doesNotMatch(sub, /2500|1300|900/)
      assert.ok(referralDisclaimersUi[lang].hostReferralCard_withdrawHint)
      assert.ok(referralDisclaimersUi[lang].hostReferralCard_welcomeSeparate)
      const pathBody = referralEarnPathsUi[lang].referralEarnPaths_partnerBody
      assert.match(pathBody, /__ACTIVATION__/)
      assert.doesNotMatch(pathBody, /2500|1300/)
      const step3 = hostReferralJourneyUi[lang].hostReferralJourney_step3Body
      assert.doesNotMatch(step3, /\{l1Pct\}/)
      assert.doesNotMatch(step3, /Хост получает бонус активации|host receives an activation bonus/i)
    }
  })

  it('guest pool defaults unchanged (42/10/5/43)', () => {
    assert.equal(FINTECH_CONFIG_DEFAULTS.ambassador_guest_pool_l1_percent, 42)
    assert.equal(FINTECH_CONFIG_DEFAULTS.ambassador_guest_pool_l2_percent, 10)
    assert.equal(FINTECH_CONFIG_DEFAULTS.ambassador_guest_pool_l3_percent, 5)
    assert.equal(FINTECH_CONFIG_DEFAULTS.ambassador_guest_pool_referee_percent, 43)
  })
})
