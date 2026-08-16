/**
 * Stage 201.70 — PDP gallery lightbox height + Instant Booking visibility.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-70-gallery-instant-booking-ux.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.70 — gallery lightbox + Instant Booking UX', () => {
  it('GalleryModal forces Dialog height and avoids Image fill collapse', () => {
    const src = read('components/listing/GalleryModal.jsx')
    assert.match(src, /sm:!h-\[90vh\]/)
    assert.match(src, /!h-\[100dvh\]/)
    assert.match(src, /max-h-\[min\(85dvh,900px\)\]/)
    assert.match(src, /width=\{1600\}/)
    assert.doesNotMatch(src, /\bfill\n/)
    assert.doesNotMatch(src, /fill\s*\n?\s*className=/)
  })

  it('wizard Instant Booking block is visually emphasized', () => {
    const src = read('app/(partner)/partner/listings/new/components/StepPricing.jsx')
    assert.match(src, /partnerListing_instantBookingBadge/)
    assert.match(src, /bg-brand\/10/)
    assert.match(src, /<Zap /)
    assert.match(src, /data-testid="partner-listing-instant-booking"/)
  })

  it('PDP Instant Book pay hint is a brand status chip when enabled', () => {
    const src = read('components/listing/booking/BookingActionButtons.jsx')
    assert.match(src, /data-instant-book="1"/)
    assert.match(src, /bg-brand\/10/)
    assert.match(src, /listingBookingPayHintInstant/)
  })

  i18nBadgePresent()
})

function i18nBadgePresent() {
  it('i18n badge key exists for ru/en/zh/th', () => {
    const src = read('lib/translations/listings-partner-wizard.js')
    const matches = src.match(/partnerListing_instantBookingBadge:/g) || []
    assert.equal(matches.length, 4)
  })
}
