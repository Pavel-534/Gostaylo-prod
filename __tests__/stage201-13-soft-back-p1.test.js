/**
 * Stage 201.13 — soft-back SSOT P1 (storefront nested + partner More).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-13-soft-back-p1.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.13 — soft-back SSOT P1', () => {
  it('soft-back-routes resolves guest nested → /profile and my-bookings → /', () => {
    const {
      resolveStorefrontSoftBack,
      resolvePartnerSoftBack,
    } = require('../lib/navigation/soft-back-routes.js')

    assert.deepEqual(resolveStorefrontSoftBack('/profile/wallet'), {
      showSoftBack: true,
      softBackFallback: '/profile',
    })
    assert.deepEqual(resolveStorefrontSoftBack('/profile/referral'), {
      showSoftBack: true,
      softBackFallback: '/profile',
    })
    assert.deepEqual(resolveStorefrontSoftBack('/profile/status'), {
      showSoftBack: true,
      softBackFallback: '/profile',
    })
    assert.deepEqual(resolveStorefrontSoftBack('/settings'), {
      showSoftBack: true,
      softBackFallback: '/profile',
    })
    assert.deepEqual(resolveStorefrontSoftBack('/renter/settings'), {
      showSoftBack: true,
      softBackFallback: '/profile',
    })
    assert.deepEqual(resolveStorefrontSoftBack('/my-bookings'), {
      showSoftBack: true,
      softBackFallback: '/',
    })
    assert.equal(resolveStorefrontSoftBack('/profile').showSoftBack, false)
    assert.equal(resolveStorefrontSoftBack('/listings').showSoftBack, false)
    assert.equal(resolveStorefrontSoftBack('/renter/favorites').showSoftBack, false)

    assert.deepEqual(resolvePartnerSoftBack('/partner/finances'), {
      showSoftBack: true,
      softBackFallback: '/partner/dashboard',
    })
    assert.deepEqual(resolvePartnerSoftBack('/partner/settings'), {
      showSoftBack: true,
      softBackFallback: '/partner/dashboard',
    })
    assert.deepEqual(resolvePartnerSoftBack('/partner/payout-profiles'), {
      showSoftBack: true,
      softBackFallback: '/partner/dashboard',
    })
    assert.deepEqual(resolvePartnerSoftBack('/partner/reviews'), {
      showSoftBack: true,
      softBackFallback: '/partner/dashboard',
    })
    assert.deepEqual(resolvePartnerSoftBack('/partner/promo'), {
      showSoftBack: true,
      softBackFallback: '/partner/dashboard',
    })
    assert.equal(resolvePartnerSoftBack('/partner/dashboard').showSoftBack, false)
    assert.equal(resolvePartnerSoftBack('/partner/listings').showSoftBack, false)
    assert.equal(resolvePartnerSoftBack('/partner/listings/new').showSoftBack, false)
    assert.equal(resolvePartnerSoftBack('/partner/bookings').showSoftBack, false)
  })

  it('StorefrontAppShell and partner layout wire AppHeader soft-back props', () => {
    const storefront = read('components/layout/StorefrontAppShell.jsx')
    assert.match(storefront, /resolveStorefrontSoftBack/)
    assert.match(storefront, /showSoftBack=\{showSoftBack\}/)
    assert.match(storefront, /softBackFallback=\{softBackFallback\}/)

    const partner = read('app/(partner)/partner/layout.js')
    assert.match(partner, /resolvePartnerSoftBack/)
    assert.match(partner, /showSoftBack=\{partnerShowSoftBack\}/)
    assert.match(partner, /softBackFallback=\{partnerSoftBackFallback\}/)
  })

  it('my-bookings and partner promo drop page-local hard home/dashboard ArrowLeft', () => {
    const bookings = read('app/(storefront)/my-bookings/page.js')
    assert.doesNotMatch(bookings, /ArrowLeft/)
    assert.doesNotMatch(bookings, /myBookings_backHome/)

    const promo = read('app/(partner)/partner/promo/page.js')
    assert.doesNotMatch(promo, /ArrowLeft/)
    assert.doesNotMatch(promo, /partnerPromo_backDashboard/)
  })
})
