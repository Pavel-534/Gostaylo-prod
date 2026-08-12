/**
 * Stage 200.108 — Partner reviews + guest-review section rhythm SSOT.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-108-partner-reviews-rhythm.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.108 — partner reviews rhythm', () => {
  it('reviews page uses section titles, divider, hub surface; keeps reply API', () => {
    const page = read('app/(partner)/partner/reviews/page.js')
    assert.match(page, /PartnerSectionDivider/)
    assert.match(page, /PARTNER_SECTION_TITLE_CLASS/)
    assert.match(page, /PARTNER_HUB_LIST_CARD_SURFACE_CLASS/)
    assert.match(page, /reviews-stats/)
    assert.match(page, /reviews-list/)
    assert.match(page, /handleSubmitReply/)
    assert.match(page, /\/api\/v2\/reviews/)
    assert.doesNotMatch(page, /border-slate-500/)
    assert.doesNotMatch(page, /border-\[#/)
  })

  it('guest-review form uses section title + field labels + hub surface', () => {
    const page = read('app/(partner)/partner/bookings/[bookingId]/guest-review/page.js')
    assert.match(page, /PARTNER_SECTION_TITLE_CLASS/)
    assert.match(page, /PARTNER_FIELD_LABEL_CLASS/)
    assert.match(page, /PARTNER_HUB_LIST_CARD_SURFACE_CLASS/)
    assert.match(page, /guest-review-form/)
    assert.match(page, /\/api\/v2\/partner\/guest-reviews/)
    assert.match(page, /min-h-\[44px\]/)
    assert.match(page, /handleSubmit/)
  })

  it('section i18n keys exist for ru/en', () => {
    const i18n = read('lib/translations/slices/partner-shell.js')
    for (const key of ['partnerReviews_sectionStats', 'partnerReviews_sectionList']) {
      assert.ok(i18n.includes(`${key}:`), `missing ${key}`)
    }
  })
})
