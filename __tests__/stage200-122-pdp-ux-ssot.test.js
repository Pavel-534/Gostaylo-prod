/**
 * Stage 200.122 — PDP UX SSOT (mobile breakdown exclusions, cancel trust, rounding line).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-122-pdp-ux-ssot.test.js
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildGuestPriceExclusionHints } from '@/lib/booking/guest-price-exclusions.js'
import {
  LISTING_CANCELLATION_ANCHOR_ID,
  listingCancellationAnchorHref,
} from '@/lib/listing/listing-cancellation-anchor.js'
import { resolveListingBookingTrustCancelLabel } from '@/lib/listing/listing-booking-trust-cancel.js'
import { listingsPublicUi } from '@/lib/translations/listings-public.js'

const root = process.cwd()

describe('Stage 200.122 — PDP UX SSOT', () => {
  it('mobile planner passes category + metadata into price breakdown', () => {
    const src = readFileSync(
      join(root, 'components/listing/pdp/ListingMobileActions.jsx'),
      'utf8',
    )
    assert.ok(src.includes('listingCategorySlug={listingCategorySlug}'))
    assert.ok(src.includes('listingMetadata={listing?.metadata'))
    assert.ok(src.includes('max-sm:pt-1'))
    assert.doesNotMatch(src, /bg-white p-4 rounded-lg/)
    assert.ok(src.includes('min-h-11'))
    assert.ok(src.includes('listing-ask-partner-unavailable'))
  })

  it('exclusion hints still work for stay cleaning / deposit', () => {
    const hints = buildGuestPriceExclusionHints('apartments', {
      cleaning_fee_thb: 500,
      security_deposit_thb: 2000,
    })
    assert.ok(hints.some((h) => h.key === 'orderExcluded_stayCleaning'))
    assert.ok(hints.some((h) => h.key === 'orderExcluded_stayDeposit'))
  })

  it('cancellation trust is neutral for strict/moderate; soft only for flexible', () => {
    assert.equal(LISTING_CANCELLATION_ANCHOR_ID, 'listing-cancellation-policy')
    assert.equal(listingCancellationAnchorHref(), '#listing-cancellation-policy')

    const strictRu = resolveListingBookingTrustCancelLabel('strict', 'ru')
    assert.equal(strictRu, listingsPublicUi.ru.listingBookingTrust_cancel)
    assert.doesNotMatch(strictRu, /бесплатн/i)

    const moderateEn = resolveListingBookingTrustCancelLabel('moderate', 'en')
    assert.equal(moderateEn, listingsPublicUi.en.listingBookingTrust_cancel)
    assert.doesNotMatch(moderateEn, /free cancel/i)

    const flexEn = resolveListingBookingTrustCancelLabel('flexible', 'en')
    assert.equal(flexEn, listingsPublicUi.en.listingBookingTrust_cancelFlexible)
  })

  it('trust + policy sections wire cancellation anchor', () => {
    const trust = readFileSync(
      join(root, 'components/listing/booking/BookingTrustSignals.jsx'),
      'utf8',
    )
    assert.ok(trust.includes('listingCancellationAnchorHref'))
    assert.ok(trust.includes('listing-booking-trust-cancel'))

    const stay = readFileSync(join(root, 'components/listing/ListingStayPolicies.jsx'), 'utf8')
    assert.ok(stay.includes('LISTING_CANCELLATION_ANCHOR_ID'))

    const cancelOnly = readFileSync(
      join(root, 'components/listing/ListingCancellationPolicy.jsx'),
      'utf8',
    )
    assert.ok(cancelOnly.includes('LISTING_CANCELLATION_ANCHOR_ID'))
  })

  it('breakdown renders rounding pot line when present', () => {
    const src = readFileSync(
      join(root, 'components/listing/booking/BookingPriceBreakdown.jsx'),
      'utf8',
    )
    assert.ok(src.includes('roundingDiffPot'))
    assert.ok(src.includes('booking-breakdown-rounding'))
    assert.ok(src.includes('orderPrice_rounding'))
  })

  it('i18n cancel keys exist in four locales without free-cancel default', () => {
    for (const lang of ['ru', 'en', 'zh', 'th']) {
      const slice = listingsPublicUi[lang]
      assert.ok(String(slice.listingBookingTrust_cancel).length >= 4, lang)
      assert.ok(String(slice.listingBookingTrust_cancelFlexible).length >= 4, lang)
      assert.doesNotMatch(String(slice.listingBookingTrust_cancel), /бесплатн|Free cancel|免费取消|ยกเลิกฟรี/i)
    }
  })
})
