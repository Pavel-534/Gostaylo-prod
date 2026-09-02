/**
 * Stage 202.34 — bank-facing public copy: RF focus, no MLM/Thailand on legal/marketing SSOT.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage202-34-bank-compliance-copy.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

const BANK_VISIBLE = [
  'components/legal/PublicOfferLegalContent.jsx',
  'components/legal/PrivacyLegalContent.jsx',
  'components/legal/PartnerTermsLegalContent.jsx',
  'components/legal/LegalDefinitionsSection.jsx',
  'components/about/AboutContent.jsx',
  'components/terms/TermsContent.jsx',
  'app/(marketing)/about/page.js',
  'lib/translations/common-ui.js',
]

describe('Stage 202.34 — bank compliance copy', () => {
  it('legal + about + terms avoid MLM and Thailand in RU bank-visible pages', () => {
    for (const rel of BANK_VISIBLE) {
      const src = read(rel)
      assert.doesNotMatch(src, /\bMLM\b/i, `${rel} must not mention MLM`)
      assert.doesNotMatch(src, /многоуровнев/i, `${rel} must not say многоуровнев`)
      assert.doesNotMatch(src, /Таиланд|Пхукет|Thailand|Phuket|Bali|global rental marketplace/i, `${rel}`)
    }
  })

  it('public offer §7 is referral program (not MLM)', () => {
    const offer = read('components/legal/PublicOfferLegalContent.jsx')
    assert.match(offer, /7\. Реферальная программа/)
    assert.match(offer, /7\. Referral program/)
    assert.doesNotMatch(offer, /avgEarnedFromStats/)
  })

  it('legal version bump for bank doc refresh', () => {
    assert.match(read('lib/config/legal-terms-version.js'), /2026-09-02-v1/)
    assert.match(read('lib/config/legal-details.js'), /2 сентября 2026/)
  })
})
