/**
 * Stage 200.103 — Partner bookings list rhythm (SSOT hub card surface + section titles).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-103-partner-bookings-rhythm.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.103 — partner bookings rhythm', () => {
  it('PartnerBookingCard uses hub surface + MOBILE_FLAT; no hex / border-slate-500', () => {
    const card = read('components/partner/bookings/PartnerBookingCard.jsx')
    assert.match(card, /MOBILE_FLAT_CARD_CLASS/)
    assert.match(card, /PARTNER_HUB_LIST_CARD_SURFACE_CLASS/)
    assert.match(card, /min-h-\[44px\]/)
    assert.doesNotMatch(card, /border-slate-500/)
    assert.doesNotMatch(card, /border-\[#/)
    assert.doesNotMatch(card, /bg-\[#/)
  })

  it('PartnerBookingList groups with PARTNER_SECTION_TITLE + PartnerSectionDivider', () => {
    const list = read('components/partner/bookings/PartnerBookingList.jsx')
    assert.match(list, /PartnerSectionDivider/)
    assert.match(list, /PARTNER_SECTION_TITLE_CLASS/)
    assert.match(list, /buildBookingSections/)
    assert.match(list, /partnerBookingTabForStatus/)
    assert.match(list, /bookings-list-groups/)
  })

  it('bookings page wires filters section + dividers; hides duplicate H1 on md+', () => {
    const page = read('app/(partner)/partner/bookings/page.js')
    assert.match(page, /PartnerSectionDivider/)
    assert.match(page, /PARTNER_HUB_PAGE_TITLE_MD_HIDE_CLASS/)
    assert.match(page, /bookings-filters/)
    assert.match(page, /bookings-list/)
    assert.match(page, /useUpdateBookingStatus/)
    assert.match(page, /filterPartnerBookingsByTab/)
    assert.match(page, /buildPartnerUnifiedOrder/)
    assert.doesNotMatch(page, /partnerBookings_filtersSectionTitle/)
  })

  it('hub list surface alias exists on partner-section-rhythm SSOT', () => {
    const rhythm = read('lib/ui/partner-section-rhythm.js')
    assert.match(rhythm, /PARTNER_HUB_LIST_CARD_SURFACE_CLASS/)
    assert.match(rhythm, /PARTNER_LISTING_CARD_SURFACE_CLASS/)
  })
})
