/**
 * Stage 200.113 — Partner WorkspaceEmptyState adoption (listings / reviews / promo).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-113-partner-empty-states.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.113 — partner WorkspaceEmptyState adoption', () => {
  it('listings page uses WorkspaceEmptyState for empty + filter-empty', () => {
    const page = read('app/(partner)/partner/listings/page.js')
    assert.match(page, /WorkspaceEmptyState/)
    assert.match(page, /partner-listings-empty/)
    assert.match(page, /partner-listings-empty-filter/)
    assert.match(page, /PARTNER_HUB_LIST_CARD_SURFACE_CLASS/)
    assert.match(page, /partnerListings_emptyTitle/)
    assert.match(page, /partnerListings_emptyFilterHint/)
    assert.match(page, /usePartnerListingPatch/)
  })

  it('reviews page uses WorkspaceEmptyState + LoadingPageShell; keeps reply API', () => {
    const page = read('app/(partner)/partner/reviews/page.js')
    assert.match(page, /WorkspaceEmptyState/)
    assert.match(page, /LoadingPageShell/)
    assert.match(page, /partner-reviews-empty/)
    assert.match(page, /partnerReviewsEmpty/)
    assert.match(page, /\/api\/v2\/reviews/)
    assert.match(page, /handleSubmitReply/)
  })

  it('promo page uses WorkspaceEmptyState for empty codes list', () => {
    const page = read('app/(partner)/partner/promo/page.js')
    assert.match(page, /WorkspaceEmptyState/)
    assert.match(page, /partner-promo-empty/)
    assert.match(page, /partnerPromo_emptyCodes/)
    assert.match(page, /\/api\/v2\/partner\/promo-codes/)
  })

  it('emptyFilterHint i18n exists for ru/en', () => {
    const i18n = read('lib/translations/slices/partner-ui.js')
    assert.ok(i18n.includes('partnerListings_emptyFilterHint:'), 'missing emptyFilterHint')
  })
})
