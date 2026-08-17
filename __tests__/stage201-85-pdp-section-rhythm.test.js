/**
 * Stage 201.85 — PDP section rhythm SSOT (hairline + equal py).
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  LISTING_PDP_INTERNAL_SPLIT_CLASS,
  LISTING_PDP_RAIL_SECTION_CLASS,
  LISTING_PDP_SECTION_CLASS,
  LISTING_PDP_SECTION_PAD_CLASS,
  LISTING_PDP_SECTION_RULE_CLASS,
  LISTING_PDP_SECTION_STACK_CLASS,
  LISTING_PDP_SECTION_TITLE_CLASS,
} from '../lib/listing/pdp-section-rhythm.js'

describe('Stage 201.85 PDP section rhythm SSOT', () => {
  it('exports stack + pad + rule tokens', () => {
    assert.match(LISTING_PDP_SECTION_RULE_CLASS, /border-slate-100/)
    assert.match(LISTING_PDP_SECTION_STACK_CLASS, /divide-y/)
    assert.match(LISTING_PDP_SECTION_STACK_CLASS, /border-slate-100/)
    assert.equal(LISTING_PDP_SECTION_CLASS, LISTING_PDP_SECTION_PAD_CLASS)
    assert.match(LISTING_PDP_SECTION_PAD_CLASS, /py-8/)
  })

  it('internal hero split matches section weight', () => {
    assert.match(LISTING_PDP_INTERNAL_SPLIT_CLASS, /mt-8/)
    assert.match(LISTING_PDP_INTERNAL_SPLIT_CLASS, /pt-8/)
    assert.match(LISTING_PDP_INTERNAL_SPLIT_CLASS, /border-t/)
    assert.match(LISTING_PDP_INTERNAL_SPLIT_CLASS, /border-slate-100/)
  })

  it('rails use top rule + pad (async mount safe)', () => {
    assert.match(LISTING_PDP_RAIL_SECTION_CLASS, /border-t/)
    assert.match(LISTING_PDP_RAIL_SECTION_CLASS, /pt-8/)
    assert.match(LISTING_PDP_SECTION_TITLE_CLASS, /text-2xl/)
  })
})
