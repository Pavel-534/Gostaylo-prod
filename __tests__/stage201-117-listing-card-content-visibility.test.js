/**
 * Stage 201.117b — content-visibility rolled back on live listing cards (mobile scroll thrash).
 * Map UX constants must stay imported in InteractiveSearchMap (polygon draw regression).
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

describe('Stage 201.117b — listing card content-visibility rollback + map constants', () => {
  it('live ListingCard does not apply content-visibility class', () => {
    assert.equal(LISTING_CARD_CONTENT_VISIBILITY_CLASS, '')
    const src = read('components/listing-card.jsx')
    assert.doesNotMatch(src, /LISTING_CARD_CONTENT_VISIBILITY_CLASS/)
    assert.match(src, /isSolo \? 'h-auto' : 'h-full'/)
  })

  it('InteractiveSearchMap keeps catalog-map-ux-policy imports (map open crash fix)', () => {
    const src = read('components/listing/InteractiveSearchMap.jsx')
    assert.match(src, /from ['"]@\/lib\/maps\/catalog-map-ux-policy['"]/)
    assert.match(src, /CATALOG_MAP_BBOX_EMIT_DEBOUNCE_MS/)
    assert.match(src, /CATALOG_MAP_SELECTION_PAN_HIGHLIGHT_ONLY/)
    assert.match(src, /MapPolygonDrawChrome/)
  })
})
