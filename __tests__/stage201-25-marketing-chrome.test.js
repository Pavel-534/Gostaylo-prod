/**
 * Stage 201.25 — marketing chrome: no city hardcode, sans + brand CTAs.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-25-marketing-chrome.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.25 — marketing chrome', () => {
  it('about eyebrow is Super App; Phuket only in founding story; sans + brand Button', () => {
    const src = read('components/about/AboutContent.jsx')
    assert.doesNotMatch(src, /eyebrow:.*Phuket/i)
    assert.doesNotMatch(src, /eyebrow:.*Пхукет/)
    assert.match(src, /Пхукет/)
    assert.match(src, /Phuket/)
    assert.doesNotMatch(src, /без посредников/)
    assert.doesNotMatch(src, /font-serif/)
    assert.doesNotMatch(src, /amber-50/)
    assert.match(src, /eyebrow: 'Супер-приложение'/)
    assert.match(src, /eyebrow: 'Super App'/)
    assert.match(src, /variant="brand"/)
  })

  it('terms and help drop serif / amber / teal resort chrome', () => {
    const terms = read('components/terms/TermsContent.jsx')
    assert.doesNotMatch(terms, /font-serif/)
    assert.doesNotMatch(terms, /amber-50/)
    assert.match(terms, /variant="brand"/)

    const help = read('app/(marketing)/help/page.js')
    assert.doesNotMatch(help, /font-serif/)
    assert.doesNotMatch(help, /Help Center/)
    assert.doesNotMatch(help, /teal-50|amber-50/)
    assert.match(help, /variant="brand"/)
  })

  it('referral metadata uses getSiteDisplayName', () => {
    const src = read('app/(marketing)/about/referral/page.js')
    assert.match(src, /getSiteDisplayName\(\)/)
    assert.doesNotMatch(src, /Airento/)
  })
})
