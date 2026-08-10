/**
 * Stage 210.5 — Concierge Supply Slice 5 (partner review UX).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage210-5-concierge-partner-ux.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 210.5 — Concierge listing helpers', () => {
  it('detects concierge drafts by import_platform and metadata', async () => {
    const {
      isConciergeImportListing,
      isConciergeDraftListing,
      countConciergeDraftListings,
    } = await import('../lib/partner/concierge-listing-ui.js')

    assert.equal(
      isConciergeImportListing({ import_platform: 'concierge', metadata: { is_draft: true } }),
      true,
    )
    assert.equal(
      isConciergeImportListing({ importPlatform: 'concierge_pdf', metadata: {} }),
      true,
    )
    assert.equal(
      isConciergeImportListing({
        import_platform: 'airbnb',
        metadata: { concierge_protected: true },
      }),
      true,
    )
    assert.equal(isConciergeImportListing({ import_platform: 'airbnb', metadata: {} }), false)

    assert.equal(
      isConciergeDraftListing({
        import_platform: 'concierge',
        metadata: { is_draft: true },
      }),
      true,
    )
    assert.equal(
      isConciergeDraftListing({
        import_platform: 'concierge',
        metadata: { is_draft: false },
      }),
      false,
    )

    assert.equal(
      countConciergeDraftListings([
        { import_platform: 'concierge', metadata: { is_draft: true } },
        { import_platform: 'concierge', metadata: { is_draft: false } },
        { import_platform: 'airbnb', metadata: { is_draft: true } },
        { importPlatform: 'concierge_xlsx', metadata: { is_draft: 'true' } },
      ]),
      2,
    )
  })
})

describe('Stage 210.5 — welcome banner + badge UI', () => {
  it('welcome banner component exposes testids and count placeholder', () => {
    const banner = read('components/partner/listings/PartnerConciergeWelcomeBanner.jsx')
    assert.match(banner, /concierge-welcome-banner/)
    assert.match(banner, /replace\(\/\\\{count\\\}/)
    assert.match(banner, /concierge-welcome-review-btn/)
    assert.match(banner, /concierge-welcome-dismiss-btn/)
    assert.match(banner, /partnerListings_conciergeWelcomeBody/)

    const badgeActions = read('components/partner/listings/PartnerListingCardActions.jsx')
    assert.match(badgeActions, /showConciergeReviewCta/)
    assert.match(badgeActions, /concierge-review-btn-/)
  })

  it('page wires concierge_welcome, badge and review CTA', () => {
    const page = read('app/(partner)/partner/listings/page.js')
    assert.match(page, /concierge_welcome/)
    assert.match(page, /PartnerConciergeWelcomeBanner/)
    assert.match(page, /showConciergeReviewCta/)
    assert.match(page, /concierge-badge-/)
    assert.match(page, /isConciergeDraftListing/)
    assert.match(page, /countConciergeDraftListings/)

    const wizard = read('app/(partner)/partner/listings/new/components/ListingWizardPageInner.jsx')
    assert.match(wizard, /ConciergeWizardReviewBanner/)
    assert.match(wizard, /showConciergeReviewHint/)

    const listApi = read('app/api/v2/partner/listings/route.js')
    assert.match(listApi, /importPlatform/)

    const i18n = read('lib/translations/slices/partner-ui.js')
    assert.match(i18n, /partnerListings_conciergeWelcomeBody/)
    assert.match(i18n, /\{brand\}/)
  })
})
