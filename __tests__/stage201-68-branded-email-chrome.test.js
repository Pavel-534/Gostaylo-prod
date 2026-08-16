/**
 * Stage 201.68 — branded email chrome SSOT + listing moderation premium templates.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-68-branded-email-chrome.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.68 — branded email chrome SSOT', () => {
  it('email brand assets point at public PNG lockup', () => {
    const assets = read('lib/email/email-brand-assets.js')
    assert.match(assets, /EMAIL_BRAND_LOCKUP_PUBLIC_PATH\s*=\s*'\/brand\/airento-lockup\.png'/)
    assert.ok(fs.existsSync(path.join(root, 'public/brand/airento-lockup.png')))
  })

  it('premium header embeds lockup img via emailBrandLockupUrl', () => {
    const html = read('lib/email/premium-email-html.js')
    assert.match(html, /emailBrandLockupUrl/)
    assert.match(html, /EMAIL_BRAND_LOCKUP_PUBLIC_PATH/)
    assert.match(html, /<img src=/)
  })

  it('listing moderation templates use premium document', async () => {
    const {
      buildListingApprovedEmailTemplate,
      buildListingRejectedEmailTemplate,
    } = await import('../lib/email/listing-moderation-email.js')
    const ok = buildListingApprovedEmailTemplate({ title: 'Test Villa' }, 'ru')
    assert.match(ok.subject, /одобрено/i)
    assert.match(ok.html, /airento-lockup\.png/)
    assert.match(ok.html, /Test Villa/)
    assert.match(ok.html, /partner\/listings/)

    const no = buildListingRejectedEmailTemplate({ title: 'Prado' }, 'Неполное описание', 'ru')
    assert.match(no.subject, /отклонено/i)
    assert.match(no.html, /Неполное описание/)
    assert.match(no.html, /airento-lockup\.png/)
  })

  it('marketing events wire premium listing moderation via EmailService', () => {
    const src = read('lib/services/notifications/marketing-events.js')
    assert.match(src, /EmailService\.sendListingApproved/)
    assert.match(src, /EmailService\.sendListingRejected/)
    assert.match(src, /deliverPremiumEmailWithPlainFallback/)
    const svc = read('lib/services/email.service.js')
    assert.match(svc, /sendListingApproved/)
    assert.match(svc, /buildListingApprovedEmailTemplate/)
  })
})
