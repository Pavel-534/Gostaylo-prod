/**
 * Stage 200.131 — partner hub soft-card mobile padding SSOT.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-131-partner-hub-soft-card-pad.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.131 — partner hub soft-card pad SSOT', () => {
  it('exports soft-card pad tokens that beat MOBILE_FLAT max-sm:p-0', () => {
    const src = read('lib/ui/partner-section-rhythm.js')
    assert.match(src, /PARTNER_HUB_SOFT_CARD_PAD_CLASS = 'max-sm:p-3'/)
    assert.match(src, /PARTNER_HUB_SOFT_CARD_HEADER_PAD_CLASS/)
    assert.match(src, /PARTNER_HUB_SOFT_CARD_CONTENT_PAD_CLASS/)
    assert.match(src, /max-sm:px-3/)
  })

  it('listings stats + dashboard metric cards use soft pad', () => {
    const listings = read('app/(partner)/partner/listings/page.js')
    const dash = read('components/partner/dashboard/PartnerDashboardPageContent.jsx')
    const money = read('components/partner/dashboard/PartnerDashboardMoneyCard.jsx')
    assert.match(listings, /PARTNER_HUB_SOFT_CARD_PAD_CLASS/)
    assert.match(dash, /PARTNER_HUB_SOFT_CARD_PAD_CLASS/)
    assert.match(money, /PARTNER_HUB_SOFT_CARD_HEADER_PAD_CLASS/)
    assert.match(money, /PARTNER_HUB_SOFT_CARD_CONTENT_PAD_CLASS/)
  })

  it('finances balance / math / stats use soft pad; payout no-profile copy not duplicated', () => {
    const strip = read('components/partner/finances/PartnerFinancesBalanceStrip.jsx')
    const math = read('components/partner/finances/PartnerFinancesPayoutMathCard.jsx')
    const stat = read('components/partner/finances/PartnerFinancesStatCard.jsx')
    assert.match(strip, /PARTNER_HUB_SOFT_CARD_PAD_CLASS/)
    assert.match(math, /PARTNER_HUB_SOFT_CARD_CONTENT_PAD_CLASS/)
    assert.match(stat, /PARTNER_HUB_SOFT_CARD_HEADER_PAD_CLASS/)
    const noProfileHits = math.split("partnerFinances_payoutMathDescNoProfile").length - 1
    assert.equal(noProfileHits, 1, 'no-profile copy should render once')
  })

  it('ledger amount ≈ uses gap-x-1 (not cramped nbsp)', () => {
    const amt = read('components/partner/finances/partner-host-amount-display.jsx')
    assert.match(amt, /gap-x-1/)
    assert.doesNotMatch(amt, /≈&nbsp;/)
  })

  it('reviews + calendar education + empty state get mobile horizontal pad', () => {
    const reviews = read('app/(partner)/partner/reviews/page.js')
    const edu = read('components/partner/PartnerCalendarEducationCard.jsx')
    const empty = read('components/empty-state.jsx')
    assert.match(reviews, /PARTNER_HUB_SOFT_CARD_PAD_CLASS/)
    assert.match(edu, /PARTNER_HUB_SOFT_CARD_PAD_CLASS/)
    assert.match(empty, /max-sm:px-4/)
  })
})
