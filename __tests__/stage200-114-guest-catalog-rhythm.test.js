/**
 * Stage 200.114 — Guest catalog rhythm polish (/listings).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-114-guest-catalog-rhythm.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.114 — guest catalog rhythm', () => {
  it('ListingSidebar empty CTA uses catalogShowAllListings (no ru/en hardcode)', () => {
    const src = read('components/search/ListingSidebar.jsx')
    assert.match(src, /catalogShowAllListings/)
    assert.doesNotMatch(src, /language === 'ru' \? 'Показать все объекты'/)
    assert.doesNotMatch(src, /Show all listings'/)
  })

  it('AI banner uses brand tokens and no sparkle emoji', () => {
    const src = read('components/search/ListingSidebar.jsx')
    assert.match(src, /catalog-ai-search-banner/)
    assert.match(src, /sm:bg-brand\/5/)
    assert.match(src, /sm:border-brand\/20/)
    assert.doesNotMatch(src, /violet-/)
    assert.doesNotMatch(src, /✨/)
  })

  it('Load more button has min-h-[44px] touch target', () => {
    const src = read('components/search/ListingSidebar.jsx')
    assert.match(src, /onLoadMore[\s\S]*?min-h-\[44px\]/)
  })

  it('ListingCardSkeleton uses BODY_PAD + MEDIA_ASPECT + gsl-shimmer', () => {
    const src = read('components/listing-card-skeleton.jsx')
    assert.match(src, /LISTING_CARD_BODY_PAD/)
    assert.match(src, /LISTING_CARD_MEDIA_ASPECT/)
    assert.match(src, /gsl-shimmer/)
    assert.doesNotMatch(src, /\bp-5\b/)
    assert.doesNotMatch(src, /animate-\[shimmer/)
  })

  it('listing-card-layout SSOT keeps mobile 5/4 media + body pad', () => {
    const layout = read('lib/listing/listing-card-layout.js')
    assert.match(layout, /aspect-\[5\/4\]/)
    assert.match(layout, /LISTING_CARD_BODY_PAD = 'p-3 sm:p-4'/)
  })

  it('catalog client has no legacy product brand in file header comments', () => {
    const src = read('app/(storefront)/listings/listings-catalog-client.jsx')
    assert.doesNotMatch(src, /GoStayLo|Gostaylo/)
  })

  it('does not import partner mint tokens into guest catalog list chrome', () => {
    const sidebar = read('components/search/ListingSidebar.jsx')
    const skeleton = read('components/listing-card-skeleton.jsx')
    assert.doesNotMatch(sidebar, /PARTNER_/)
    assert.doesNotMatch(skeleton, /PARTNER_/)
  })
})
