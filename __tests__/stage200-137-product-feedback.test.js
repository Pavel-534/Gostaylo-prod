/**
 * Stage 200.137 — profile Help/Report CTAs + product feedback API contract.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-137-product-feedback.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.137 — product feedback Phase 1', () => {
  it('profile quick actions: Help → /help, Report opens dialog, logout col-span-2', () => {
    const src = read('components/renter/profile/RenterProfilePageContent.jsx')
    assert.match(src, /href="\/help"/)
    assert.match(src, /ProductFeedbackDialog/)
    assert.match(src, /setShowFeedbackDialog\(true\)/)
    assert.match(src, /col-span-2/)
    assert.match(src, /profileHelp/)
    assert.match(src, /profileReportProblem/)
  })

  it('ProductFeedbackDialog uses feedback client, not chat escalate', () => {
    const src = read('components/product-feedback-dialog.jsx')
    assert.match(src, /mobileAnchor="bottom"/)
    assert.match(src, /postProductFeedback/)
    assert.match(src, /pageUrl/)
    assert.doesNotMatch(src, /postChatEscalate/)
    assert.doesNotMatch(src, /SupportRequestDialog/)
  })

  it('POST /api/v2/feedback requires session and delivers to ops', () => {
    const route = read('app/api/v2/feedback/route.js')
    assert.match(route, /requireSessionUser/)
    assert.match(route, /deliverProductFeedback/)
    assert.match(route, /allowProductFeedbackRate/)
    assert.match(route, /auth\.profile\?\.role/)

    const service = read('lib/feedback/submit-product-feedback.js')
    assert.match(service, /notifySystemAlert/)
    assert.match(service, /getSupportInboxEmail/)
    assert.match(service, /EmailService\.sendEmail/)
    assert.match(service, /audience/)
    assert.doesNotMatch(service, /getPublicSupportEmail/)
    assert.doesNotMatch(service, /NEXT_PUBLIC_SUPPORT_EMAIL/)
    assert.doesNotMatch(service, /postChatEscalate/)

    const inbox = read('lib/config/support-inbox-email.js')
    assert.match(inbox, /SUPPORT_INBOX_EMAIL/)
    assert.match(inbox, /PROCESS_SUPPORT_EMAIL/)
    assert.doesNotMatch(inbox, /NEXT_PUBLIC_SUPPORT_EMAIL/)
  })

  it('feedback categories + validation SSOT', async () => {
    const opts = read('lib/feedback/product-feedback-options.js')
    assert.match(opts, /technical/)
    assert.match(opts, /ux/)
    assert.match(opts, /idea/)
    assert.match(opts, /other/)
    assert.match(opts, /Сбой на сайте/)

    const {
      validateProductFeedbackBody,
      normalizeProductFeedbackAudience,
    } = await import('../lib/feedback/product-feedback-options.js')

    assert.equal(normalizeProductFeedbackAudience('PARTNER'), 'partner')
    assert.equal(normalizeProductFeedbackAudience('RENTER'), 'guest')
    assert.equal(normalizeProductFeedbackAudience('ADMIN'), 'staff')

    const bad = validateProductFeedbackBody({ category: 'nope', details: 'short' }, { userId: 'u1' })
    assert.equal(bad.ok, false)

    const short = validateProductFeedbackBody(
      { category: 'technical', details: 'tiny' },
      { userId: 'u1' },
    )
    assert.equal(short.ok, false)
    assert.equal(short.error, 'DETAILS_TOO_SHORT')

    const ok = validateProductFeedbackBody(
      {
        category: 'ux',
        details: 'Something is confusing on checkout',
        pathname: '/checkout',
        pageUrl: 'https://example.com/checkout?x=1',
        userAgent: 'TestAgent',
      },
      { userId: 'u1', email: 'a@b.co', role: 'PARTNER' },
    )
    assert.equal(ok.ok, true)
    assert.equal(ok.payload.category, 'ux')
    assert.equal(ok.payload.pathname, '/checkout')
    assert.equal(ok.payload.pageUrl, 'https://example.com/checkout?x=1')
    assert.equal(ok.payload.audience, 'partner')
    assert.equal(ok.payload.role, 'PARTNER')
  })

  it('support inbox helper ignores public NEXT_PUBLIC display email', async () => {
    const { getSupportInboxEmail } = await import('../lib/config/support-inbox-email.js')
    const prevInbox = process.env.SUPPORT_INBOX_EMAIL
    const prevProcess = process.env.PROCESS_SUPPORT_EMAIL
    const prevPublic = process.env.NEXT_PUBLIC_SUPPORT_EMAIL
    try {
      delete process.env.SUPPORT_INBOX_EMAIL
      delete process.env.PROCESS_SUPPORT_EMAIL
      process.env.NEXT_PUBLIC_SUPPORT_EMAIL = 'support@airento.ru'
      assert.equal(getSupportInboxEmail(), null)

      process.env.SUPPORT_INBOX_EMAIL = 'ops-inbox@example.org'
      assert.equal(getSupportInboxEmail(), 'ops-inbox@example.org')
    } finally {
      if (prevInbox == null) delete process.env.SUPPORT_INBOX_EMAIL
      else process.env.SUPPORT_INBOX_EMAIL = prevInbox
      if (prevProcess == null) delete process.env.PROCESS_SUPPORT_EMAIL
      else process.env.PROCESS_SUPPORT_EMAIL = prevProcess
      if (prevPublic == null) delete process.env.NEXT_PUBLIC_SUPPORT_EMAIL
      else process.env.NEXT_PUBLIC_SUPPORT_EMAIL = prevPublic
    }
  })

  it('/help spacing avoids double header pad; honest SLA', () => {
    const help = read('components/help/HelpContent.jsx')
    const chrome = read('components/marketing/MarketingDocChrome.jsx')
    assert.doesNotMatch(help, /24\s*\/\s*7/)
    assert.doesNotMatch(help, /12 минут/)
    assert.match(help, /getPublicSupportEmail/)
    assert.match(help, /нескольких часов/)
    // MainContent already pads for fixed header — chrome must not double large top pad
    assert.doesNotMatch(help, /\bpt-24\b/)
    assert.doesNotMatch(help, /\bpt-28\b/)
    assert.doesNotMatch(chrome, /\bpt-24\b/)
    assert.doesNotMatch(chrome, /\bpt-28\b/)
    assert.match(chrome, /\bpt-6\b/)
  })

  it('feedback SelectContent stacks above Dialog (z-220)', () => {
    const dlg = read('components/product-feedback-dialog.jsx')
    assert.match(dlg, /z-\[230\]/)
    assert.doesNotMatch(dlg, /z-\[130\]/)
  })
})
