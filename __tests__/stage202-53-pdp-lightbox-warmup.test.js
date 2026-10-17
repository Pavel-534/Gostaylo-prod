/**
 * Stage 202.53 — PDP lightbox: hosted unoptimized + idle warmup (no black 3–5s flash).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage202-53-pdp-lightbox-warmup.test.js
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolvePdpImageSizes } from '../lib/media/image-delivery.js'
import { isHostedListingImageUrl } from '../lib/listing-image-host-utils.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 202.53 — GalleryModal hosted unoptimized parity', () => {
  it('GalleryModal uses isHostedListingImageUrl + soft fade-in onLoad', () => {
    const src = read('components/listing/GalleryModal.jsx')
    assert.match(src, /isHostedListingImageUrl/)
    assert.match(src, /lightboxImageUnoptimized/)
    assert.match(src, /onLoad=\{\(\) => setImageReady\(true\)\}/)
    assert.match(src, /warmupPdpLightboxNeighbors/)
    assert.match(src, /resolvePdpImageSizes\('lightbox'/)
  })

  it('hosted /_storage paths are treated as hosted (skip /_next/image)', () => {
    assert.equal(isHostedListingImageUrl('/_storage/listing-images/x.webp'), true)
    assert.equal(isHostedListingImageUrl('/listing-images/x.webp'), true)
    assert.equal(isHostedListingImageUrl('https://cdn.example.com/photo.jpg'), false)
  })

  it('lightbox sizes SSOT still resolves', () => {
    assert.equal(resolvePdpImageSizes('lightbox', null), '100vw')
    assert.equal(resolvePdpImageSizes('lightbox', { constrained: true }), '90vw')
  })
})

describe('Stage 202.53 — PDP idle lightbox warmup wiring', () => {
  it('ListingPdpClient warms gallery URLs after mount', () => {
    const src = read('app/(storefront)/listings/[id]/ListingPdpClient.jsx')
    assert.match(src, /warmupPdpLightboxUrls/)
    assert.match(src, /getPdpLightboxImageUrls/)
  })

  it('warmup module exists and caps constrained networks', async () => {
    const warmed = []
    const PrevImage = globalThis.Image
    const PrevWindow = globalThis.window

    class FakeImage {
      set src(v) {
        warmed.push(v)
      }
      get src() {
        return ''
      }
    }

    globalThis.Image = FakeImage
    globalThis.window = {
      requestIdleCallback: (cb) => {
        cb()
        return 1
      },
      setTimeout: (cb) => {
        cb()
        return 1
      },
    }

    // Fresh import after globals — module caches warmedUrls; use unique URLs.
    const { warmupPdpLightboxUrls, warmupPdpLightboxNeighbors } = await import(
      '../lib/media/pdp-lightbox-warmup.js'
    )

    const urls = [
      '/_storage/a.webp',
      '/_storage/b.webp',
      '/_storage/c.webp',
      '/placeholder.svg',
    ]
    warmupPdpLightboxUrls(urls, { immediate: true, max: 2 })
    assert.deepEqual(warmed, ['/_storage/a.webp', '/_storage/b.webp'])

    warmed.length = 0
    warmupPdpLightboxNeighbors(
      ['/_storage/n0.webp', '/_storage/n1.webp', '/_storage/n2.webp'],
      1,
    )
    assert.ok(warmed.includes('/_storage/n1.webp'))
    assert.ok(warmed.includes('/_storage/n2.webp'))
    assert.ok(warmed.includes('/_storage/n0.webp'))

    globalThis.Image = PrevImage
    globalThis.window = PrevWindow
  })
})
