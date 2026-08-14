/**
 * Stage 201.14 — soft-back hard-exit cleanup + marketing top-pad tighten.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-14-soft-back-pad-cleanup.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.14 — soft-back + marketing pad cleanup', () => {
  it('storefront resolver covers public profiles, go vanity, renter review', () => {
    const { resolveStorefrontSoftBack, resolvePartnerSoftBack } = require('../lib/navigation/soft-back-routes.js')
    assert.deepEqual(resolveStorefrontSoftBack('/u/abc'), {
      showSoftBack: true,
      softBackFallback: '/listings',
    })
    assert.deepEqual(resolveStorefrontSoftBack('/go/vanity'), {
      showSoftBack: true,
      softBackFallback: '/listings',
    })
    assert.deepEqual(resolveStorefrontSoftBack('/renter/reviews/new'), {
      showSoftBack: true,
      softBackFallback: '/my-bookings',
    })
    assert.deepEqual(
      resolvePartnerSoftBack('/partner/bookings/bk-1/guest-review'),
      { showSoftBack: true, softBackFallback: '/partner/bookings' },
    )
  })

  it('marketing heroes no longer use pt-24 under MainContent', () => {
    assert.doesNotMatch(read('components/about/AboutContent.jsx'), /pt-24|sm:pt-28/)
    assert.match(read('components/about/AboutContent.jsx'), /pt-6 sm:pt-8/)
    assert.doesNotMatch(read('components/terms/TermsContent.jsx'), /pt-24|sm:pt-28/)
    assert.match(read('components/legal/legal-doc-shell.jsx'), /py-8 sm:px-8 sm:py-12/)
  })

  it('hard ArrowLeft exits removed from public profile / go landing / review flows', () => {
    assert.doesNotMatch(read('app/(storefront)/u/[id]/PublicUserProfileClient.jsx'), /ArrowLeft/)
    assert.doesNotMatch(read('components/referral/AmbassadorPublicLanding.jsx'), /ArrowLeft/)
    assert.doesNotMatch(read('app/(storefront)/renter/reviews/new/page.js'), /ArrowLeft/)
    assert.doesNotMatch(
      read('app/(partner)/partner/bookings/[bookingId]/guest-review/page.js'),
      /ArrowLeft/,
    )
  })
})
