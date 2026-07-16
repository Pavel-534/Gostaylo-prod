/**
 * Stage 171.41 — guard against duplicate PostgREST categories embeds
 * (`table name "listings_categories_1" specified more than once`).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, test } from 'node:test'
import { LISTINGS_SELECT_LITE } from '@/lib/api/search/listing-search-payload.js'

function countCategoriesEmbeds(selectSql) {
  const s = String(selectSql || '')
  const named = (s.match(/categories\s*:\s*category_id/gi) || []).length
  const plain = (s.match(/\bcategories\s*\(/gi) || []).length
  return named + plain
}

describe('similar-listings ANCHOR_SELECT', () => {
  test('LISTINGS_SELECT_LITE embeds categories at most once', () => {
    assert.equal(countCategoriesEmbeds(LISTINGS_SELECT_LITE), 1)
  })

  test('service select must not stack categories on LISTINGS_SELECT_LITE', () => {
    const path = fileURLToPath(new URL('../lib/recommendations/similar-listings.service.js', import.meta.url))
    const src = readFileSync(path, 'utf8')
    assert.match(src, /ANCHOR_SELECT\s*=\s*LISTINGS_SELECT_LITE/)
    assert.doesNotMatch(src, /categories\s*:\s*category_id/)
  })
})
