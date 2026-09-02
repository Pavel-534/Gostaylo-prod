/**
 * Stage 202.36 — referral public mode (reversible env).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage202-36-referral-public-mode.test.js
 */

const { describe, it, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 202.36 — referral public mode', () => {
  const prev = process.env.NEXT_PUBLIC_REFERRAL_PUBLIC_MODE

  afterEach(() => {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_REFERRAL_PUBLIC_MODE
    else process.env.NEXT_PUBLIC_REFERRAL_PUBLIC_MODE = prev
  })

  it('defaults to full mode', async () => {
    delete process.env.NEXT_PUBLIC_REFERRAL_PUBLIC_MODE
    const { getReferralPublicMode, isSimpleReferralPublicMode } = await import(
      '../lib/compliance/referral-public-mode.js'
    )
    assert.equal(getReferralPublicMode(), 'full')
    assert.equal(isSimpleReferralPublicMode(), false)
  })

  it('simple and bank alias enable bank-safe UI', async () => {
    const { isSimpleReferralPublicMode } = await import('../lib/compliance/referral-public-mode.js')
    process.env.NEXT_PUBLIC_REFERRAL_PUBLIC_MODE = 'simple'
    assert.equal(isSimpleReferralPublicMode(), true)
    process.env.NEXT_PUBLIC_REFERRAL_PUBLIC_MODE = 'bank'
    assert.equal(isSimpleReferralPublicMode(), true)
    process.env.NEXT_PUBLIC_REFERRAL_PUBLIC_MODE = 'full'
    assert.equal(isSimpleReferralPublicMode(), false)
  })

  it('cabinet gates team tab and engagement behind simple mode SSOT', () => {
    const page = read('components/referral/ReferralProfilePage.jsx')
    assert.match(page, /isSimpleReferralPublicMode/)
    assert.match(page, /stage1143_tabTeam/)
    assert.match(page, /!referralPublicSimple/)
    assert.match(page, /ReferralLeaderEngagementSection/)
    assert.match(page, /MlmConsentModal/)
  })

  it('calculator hides network levels in simple mode', () => {
    const calc = read('components/referral/ReferralCalculatorV2.jsx')
    assert.match(calc, /isSimpleReferralPublicMode/)
    assert.match(calc, /bankSimple/)
    assert.match(calc, /calc_result_direct_simple/)
  })

  it('overview footer uses bank-safe disclaimer in simple mode', () => {
    const page = read('components/referral/ReferralProfilePage.jsx')
    assert.match(page, /referral_simple_persistent_disclaimer/)
    assert.match(page, /referral-simple-persistent-disclaimer/)
  })

  it('simple-mode i18n avoids MLM / multi-level / L2-L3 jargon', async () => {
    const { profileAppReferralUi } = await import('../lib/translations/slices/profile-app-referral.js')
    const keys = ['referral_simple_overview_hint', 'referral_simple_persistent_disclaimer', 'calc_result_direct_simple']
    for (const lang of ['ru', 'en', 'zh', 'th']) {
      for (const key of keys) {
        const text = String(profileAppReferralUi[lang]?.[key] || '')
        assert.ok(text, `${lang}.${key}`)
        assert.doesNotMatch(text, /\bMLM\b/i, `${lang}.${key}`)
        assert.doesNotMatch(text, /многоуровнев/i, `${lang}.${key}`)
        assert.doesNotMatch(text, /multi-level/i, `${lang}.${key}`)
        assert.doesNotMatch(text, /\bL2\b|\bL3\b|\(L1\)/, `${lang}.${key}`)
      }
    }
  })
})
