/**
 * Stage 202.49 — map-pins lean metadata + LCP image SSOT + nginx co-location notes.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage202-49-map-pins-lcp-nginx.test.js
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  MAP_PINS_SELECT_CORE,
  MAP_PINS_SELECT_WITH_METADATA,
  resolveMapPinsSelect,
} from '../lib/api/search/map-pins-query.js'
import {
  LISTING_CARD_LCP_PRIORITY_COUNT,
  resolveListingCardImagePriority,
  resolvePdpHeroImagePriority,
  resolvePdpImageSizes,
} from '../lib/media/image-delivery.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 202.49 — map-pins lean metadata select', () => {
  it('browse select omits metadata; facet select includes it', () => {
    assert.doesNotMatch(MAP_PINS_SELECT_CORE, /\bmetadata\b/)
    assert.match(MAP_PINS_SELECT_WITH_METADATA, /\bmetadata\b/)
    assert.equal(resolveMapPinsSelect({ includeMetadata: false }), MAP_PINS_SELECT_CORE)
    assert.equal(resolveMapPinsSelect({ includeMetadata: true }), MAP_PINS_SELECT_WITH_METADATA)
  })

  it('buildMapPinsQuery wires includeMetadata + E2E SQL guard', () => {
    const src = read('lib/api/search/map-pins-query.js')
    assert.match(src, /resolveMapPinsSelect\(\{\s*includeMetadata\s*\}\)/)
    assert.match(src, /applyMapPinsE2eMetadataSqlGuard/)
    assert.match(src, /test_data_tag/)
  })

  it('run-map-pins-get decides includeMetadata before PostgREST', () => {
    const src = read('lib/api/run-map-pins-get.js')
    assert.match(src, /const includeMetadata = Boolean\(jsMetadataFilters\)/)
    assert.match(src, /includeMetadata,/)
    // Pin DTO still has no metadata field
    const payloadFn = src.includes('mapPinRowToPayload')
    assert.equal(payloadFn, true)
    assert.doesNotMatch(read('lib/api/search/map-pins-query.js'), /metadata:\s*row\.metadata/)
  })
})

describe('Stage 202.49 — LCP / image delivery', () => {
  it('first-screen card priority count is 4; constrained networks skip priority', () => {
    assert.equal(LISTING_CARD_LCP_PRIORITY_COUNT, 4)
    assert.equal(resolveListingCardImagePriority({ cardIndex: 0 }, null), true)
    assert.equal(resolveListingCardImagePriority({ cardIndex: 3 }, null), true)
    assert.equal(resolveListingCardImagePriority({ cardIndex: 4 }, null), false)
    assert.equal(
      resolveListingCardImagePriority({ cardIndex: 0 }, { constrained: true }),
      false,
    )
  })

  it('PDP hero priority + sizes SSOT', () => {
    assert.equal(resolvePdpHeroImagePriority({ index: 0 }, null), true)
    assert.equal(resolvePdpHeroImagePriority({ index: 1 }, null), false)
    assert.match(resolvePdpImageSizes('carousel', null), /100vw|50vw/)
  })

  it('BentoGallery + TopListingsGrid + InstantShell use image-delivery SSOT', () => {
    assert.match(read('components/listing/BentoGallery.jsx'), /resolvePdpImageSizes/)
    assert.match(read('components/listing/BentoGallery.jsx'), /resolvePdpHeroImagePriority/)
    assert.match(read('components/home/TopListingsGrid.jsx'), /resolveListingCardImagePriority/)
    assert.match(
      read('components/listing/pdp/ListingPdpInstantShell.jsx'),
      /resolvePdpImageSizes/,
    )
    assert.match(read('next.config.js'), /formats:\s*\[\s*'image\/avif'/)
  })

  it('hosted listing images stay unoptimized (Hobby Image Optimization guard)', () => {
    assert.match(read('components/listing/BentoGallery.jsx'), /isHostedListingImageUrl/)
    assert.match(
      read('components/listing/BentoGallery.jsx'),
      /Hobby quota|unoptimized/,
    )
  })
})

describe('Stage 202.49 — nginx / VPS proxy runbook present', () => {
  it('documents HTTP/2 + upstream keepalive checklist', () => {
    const rb = read('docs/runbooks/VPS_NGINX_VERCEL_PROXY.md')
    assert.match(rb, /http2/)
    assert.match(rb, /proxy_http_version\s+1\.1/)
    assert.match(rb, /keepalive/)
    assert.match(rb, /202\.49/)
  })
})
