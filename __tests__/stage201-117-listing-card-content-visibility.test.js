/**
 * Stage 201.117 — listing card grid content-visibility (off-screen layout skip).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-117-listing-card-content-visibility.test.js
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { LISTING_CARD_CONTENT_VISIBILITY_CLASS } from '@/lib/listing/listing-card-layout.js'

const root = process.cwd()

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('Stage 201.117 — listing card content-visibility', () => {
  it('SSOT class uses content-visibility auto + remembered intrinsic size', () => {
    assert.match(LISTING_CARD_CONTENT_VISIBILITY_CLASS, /content-visibility:auto/)
    assert.match(LISTING_CARD_CONTENT_VISIBILITY_CLASS, /contain-intrinsic-size:auto_/)
  })

  it('ListingCard applies CV only for grid layout (not solo)', () => {
    const src = read('components/listing-card.jsx')
    assert.match(src, /LISTING_CARD_CONTENT_VISIBILITY_CLASS/)
    assert.match(src, /isSolo \? 'h-auto' : cn\('h-full', LISTING_CARD_CONTENT_VISIBILITY_CLASS\)/)
  })

  it('deferred slot + skeleton share the same CV class', () => {
    const slot = read('components/search/CatalogDeferredCardSlot.jsx')
    const sk = read('components/listing-card-skeleton.jsx')
    assert.match(slot, /LISTING_CARD_CONTENT_VISIBILITY_CLASS/)
    assert.match(sk, /LISTING_CARD_CONTENT_VISIBILITY_CLASS/)
  })
})
