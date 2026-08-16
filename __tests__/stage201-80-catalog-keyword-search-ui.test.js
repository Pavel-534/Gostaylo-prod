/**
 * Stage 201.80 — keyword / AI search UI gate.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  CATALOG_KEYWORD_SEARCH_REACTIVATE_LISTING_HINT,
  CATALOG_KEYWORD_SEARCH_UI_ENABLED,
  isCatalogKeywordSearchUiEnabled,
} from '../lib/search/catalog-keyword-search-ui.js'
import { parseSmartSearchOnFromParams } from '../lib/search/listings-page-url.js'

describe('Stage 201.80 catalog keyword search UI gate', () => {
  it('is off at launch with reactivation hint', () => {
    assert.equal(CATALOG_KEYWORD_SEARCH_UI_ENABLED, false)
    assert.equal(isCatalogKeywordSearchUiEnabled(), false)
    assert.equal(CATALOG_KEYWORD_SEARCH_REACTIVATE_LISTING_HINT, 1000)
  })

  it('smart search defaults off without URL/localStorage', () => {
    assert.equal(parseSmartSearchOnFromParams(new URLSearchParams()), false)
    assert.equal(parseSmartSearchOnFromParams(new URLSearchParams('semantic=1')), true)
    assert.equal(parseSmartSearchOnFromParams(new URLSearchParams('semantic=0')), false)
  })
})
