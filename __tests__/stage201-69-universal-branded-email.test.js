/**
 * Stage 201.69 — all transactional emails use premium chrome (logo SSOT).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-69-universal-branded-email.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.69 — universal branded email chrome', () => {
  it('NotificationService textToHtml wraps plain text in premium lockup', async () => {
    const { textToHtml } = await import('../lib/services/notifications/email.service.js')
    const html = textToHtml('Hello line\n\nSecond block', { subject: '❌ Test subject' })
    assert.match(html, /airento-lockup\.png/)
    assert.match(html, /Hello line/)
    assert.match(html, /Second block/)
    assert.match(html, /Test subject/)
    assert.doesNotMatch(html, /Ваша платформа для аренды на Пхукете/)
  })

  it('simple transactional builder escapes dynamic text', async () => {
    const { buildSimplePremiumEmailTemplate } = await import(
      '../lib/email/simple-transactional-email.js'
    )
    const t = buildSimplePremiumEmailTemplate({
      subject: 'Hi',
      title: 'Title',
      paragraphs: ['A <script>x</script> B'],
      cta: { href: '/help', label: 'Help' },
    })
    assert.match(t.html, /airento-lockup\.png/)
    assert.match(t.html, /A &lt;script&gt;x&lt;\/script&gt; B/)
    assert.doesNotMatch(t.html, /<script>x<\/script>/)
  })

  it('auth + feedback + owner digest use premium builders', () => {
    assert.match(read('app/api/v2/auth/register/route.js'), /buildSimplePremiumEmailTemplate/)
    assert.match(read('app/api/v2/auth/forgot-password/route.js'), /buildSimplePremiumEmailTemplate/)
    assert.match(read('lib/feedback/submit-product-feedback.js'), /buildSimplePremiumEmailTemplate/)
    assert.match(
      read('lib/analytics/digest/owner-marketing-digest.format.js'),
      /premiumEmailDocument/,
    )
    assert.match(
      read('lib/services/notifications/email.service.js'),
      /buildPremiumHtmlFromPlainText/,
    )
  })
})
