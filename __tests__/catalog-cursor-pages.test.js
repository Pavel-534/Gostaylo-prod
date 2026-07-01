import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mergeCatalogListingPages } from '../lib/catalog/merge-catalog-listing-pages.js'

describe('mergeCatalogListingPages', () => {
  it('flattens pages in order', () => {
    const merged = mergeCatalogListingPages([
      [{ id: 'a' }, { id: 'b' }],
      [{ id: 'c' }],
    ])
    assert.deepEqual(merged.map((r) => r.id), ['a', 'b', 'c'])
  })

  it('dedupes by listing id across pages', () => {
    const merged = mergeCatalogListingPages([
      [{ id: 'a', title: 'first' }],
      [{ id: 'a', title: 'dup' }, { id: 'b' }],
    ])
    assert.equal(merged.length, 2)
    assert.equal(merged[0].title, 'first')
    assert.equal(merged[1].id, 'b')
  })

  it('returns empty array for invalid input', () => {
    assert.deepEqual(mergeCatalogListingPages(null), [])
    assert.deepEqual(mergeCatalogListingPages([]), [])
  })
})
