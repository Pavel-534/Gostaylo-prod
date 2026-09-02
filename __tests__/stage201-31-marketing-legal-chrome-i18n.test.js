/**
 * Stage 201.31 — unified marketing/legal chrome + Help/legal i18n.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-31-marketing-legal-chrome-i18n.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.31 — marketing/legal chrome + i18n', () => {
  it('MarketingDocChrome is SSOT for about, terms, help, legal shell', () => {
    const chrome = read('components/marketing/MarketingDocChrome.jsx')
    assert.match(chrome, /MARKETING_DOC_H1_CLASS/)
    assert.match(chrome, /MARKETING_DOC_EYEBROW_CLASS/)

    assert.match(read('components/about/AboutContent.jsx'), /MarketingDocChrome/)
    assert.match(read('components/terms/TermsContent.jsx'), /MarketingDocChrome/)
    assert.match(read('components/help/HelpContent.jsx'), /MarketingDocChrome/)
    assert.match(read('components/legal/legal-doc-shell.jsx'), /MarketingDocChrome/)
  })

  it('Help FAQ has RU and EN copy', () => {
    const help = read('components/help/HelpContent.jsx')
    assert.match(help, /Центр помощи/)
    assert.match(help, /Help Center/)
    assert.match(help, /Who holds the money\?/)
    assert.match(help, /Кто удерживает деньги\?/)
  })

  it('legal EN shows translation disclaimer; RU remains binding body', () => {
    const shell = read('components/legal/legal-doc-shell.jsx')
    assert.match(shell, /LegalTranslationDisclaimer/)
    assert.match(shell, /English translation provided for convenience/)

    const offer = read('components/legal/PublicOfferLegalContent.jsx')
    assert.match(offer, /LegalTranslationDisclaimer/)
    assert.match(offer, /публичной офертой/)
    assert.match(offer, /Public offer for information technology/)
    assert.match(offer, /showRussian/)

    for (const rel of [
      'components/legal/PrivacyLegalContent.jsx',
      'components/legal/RefundLegalContent.jsx',
      'components/legal/PartnerTermsLegalContent.jsx',
    ]) {
      const src = read(rel)
      assert.match(src, /LegalTranslationDisclaimer/)
      assert.match(src, /isRu/)
    }
  })

  it('About story has no hard-coded middleman percent', () => {
    const about = read('components/about/AboutContent.jsx')
    assert.match(about, /России/)
    assert.match(about, /Russia/)
    assert.doesNotMatch(about, /20\s*%/)
    assert.doesNotMatch(about, /twenty percent/i)
  })

  it('public offer has claims path and RF applicable law (§6–§7)', () => {
    const offer = read('components/legal/PublicOfferLegalContent.jsx')
    assert.match(offer, /Ответственность и претензии/)
    assert.match(offer, /Применимое право/)
    assert.match(offer, /2300-1/)
    assert.match(offer, /Liability and claims/)
    assert.match(offer, /Applicable law/)
    assert.match(offer, /supportEmail/)

    const ver = read('lib/config/legal-terms-version.js')
    assert.match(ver, /2026-09-02-v1/)
  })
})
