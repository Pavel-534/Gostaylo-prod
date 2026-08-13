/**
 * Stage 200.136 — wizard listing preview uses ListingCard layout=solo (no stretch void).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-136-wizard-preview-card-solo.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.136 — wizard preview ListingCard solo layout', () => {
  it('ListingCard supports layout=solo without h-full / mt-auto stretch', () => {
    const src = read('components/listing-card.jsx')
    assert.match(src, /layout = 'grid'/)
    assert.match(src, /isSolo = layout === 'solo'/)
    assert.match(src, /isSolo \? 'h-auto' : 'h-full'/)
    assert.match(src, /isSolo \? 'mt-3' : 'mt-auto'/)
    assert.match(src, /data-listing-card-layout/)
  })

  it('wizard preview panel + step 6 use layout=solo', () => {
    assert.match(read('app/(partner)/partner/listings/new/components/preview/ListingWizardPreviewContent.jsx'), /layout="solo"/)
    assert.match(read('app/(partner)/partner/listings/new/components/StepPreview.jsx'), /layout="solo"/)
  })
})
