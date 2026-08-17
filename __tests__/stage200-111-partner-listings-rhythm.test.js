/**
 * Stage 200.111 / 201.87 — Partner listings list rhythm (no duplicate page titles).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-111-partner-listings-rhythm.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.111 / 201.87 — partner listings list rhythm', () => {
  it('listings page: filters+list without redundant section H2; hub surface; patch/delete', () => {
    const page = read('app/(partner)/partner/listings/page.js')
    assert.match(page, /PartnerSectionDivider/)
    assert.match(page, /PARTNER_HUB_PAGE_TITLE_MD_HIDE_CLASS/)
    assert.match(page, /PARTNER_HUB_LIST_CARD_SURFACE_CLASS/)
    assert.match(page, /PARTNER_LISTING_CARD_SURFACE_CLASS/)
    assert.match(page, /listings-filters/)
    assert.match(page, /listings-list/)
    assert.doesNotMatch(page, /partnerListings_sectionList/)
    assert.doesNotMatch(page, /listings-stats/)
    assert.match(page, /usePartnerListings/)
    assert.match(page, /usePartnerListingPatch/)
    assert.match(page, /usePartnerListingDelete/)
    assert.match(page, /publishListing/)
    assert.match(page, /min-h-\[44px\]/)
    assert.doesNotMatch(page, /border-slate-500/)
    assert.doesNotMatch(page, /border-\[#/)
  })

  it('section i18n keys + unified title exist for ru/en', () => {
    const i18n = read('lib/translations/slices/partner-ui.js')
    for (const key of ['partnerListings_sectionFilters', 'partnerListings_sectionList', 'partnerListings_title']) {
      assert.ok(i18n.includes(`${key}:`), `missing ${key}`)
    }
    assert.match(i18n, /partnerListings_title: 'Мои объявления'/)
  })
})
