/**
 * Stage 202.51 — desktop PDP bento secondary tiles must not vanish on constrained NetInfo.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage202-51-pdp-bento-secondary.test.js
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 202.51 — desktop PDP bento secondary always mounts', () => {
  it('BentoGallery does not gate desktop secondary on shouldMountPdpBentoSecondary', () => {
    const src = read('components/listing/BentoGallery.jsx')
    assert.doesNotMatch(src, /shouldMountPdpBentoSecondary/)
    assert.match(src, /\{multiPhoto\s*\n\s*\? displayUrls\.slice\(1, 5\)/)
    assert.match(src, /Stage 202\.51/)
  })

  it('still resolves sizes/priority via image-delivery SSOT', () => {
    const src = read('components/listing/BentoGallery.jsx')
    assert.match(src, /resolvePdpImageSizes/)
    assert.match(src, /resolvePdpHeroImagePriority/)
  })
})
