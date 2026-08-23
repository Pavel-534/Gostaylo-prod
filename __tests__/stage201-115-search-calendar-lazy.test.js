/**
 * Stage 201.115 — SearchCalendar deferred from UnifiedSearchBar chunk.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-115-search-calendar-lazy.test.js
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('Stage 201.115 — SearchCalendar lazy chunk', () => {
  it('UnifiedSearchBar does not statically import search-calendar or date-fns', () => {
    const bar = read('components/search/UnifiedSearchBar.jsx')
    assert.doesNotMatch(bar, /from ['"]@\/components\/search-calendar['"]/)
    assert.doesNotMatch(bar, /from ['"]date-fns/)
    assert.match(bar, /SearchCalendarLazy/)
  })

  it('SearchCalendarLazy defers chunk until intent (idle shell + dynamic)', () => {
    const lazy = read('components/search/SearchCalendarLazy.jsx')
    assert.match(lazy, /dynamic\(importSearchCalendar/)
    assert.match(lazy, /ssr:\s*false/)
    assert.match(lazy, /search-calendar-idle-trigger/)
    assert.match(lazy, /prefetchSearchCalendarChunk/)
    assert.match(lazy, /defaultOpen/)
  })

  it('SearchCalendar supports defaultOpen after lazy activate', () => {
    const cal = read('components/search-calendar.jsx')
    assert.match(cal, /defaultOpen\s*=\s*false/)
    assert.match(cal, /Stage 201\.115/)
  })
})
