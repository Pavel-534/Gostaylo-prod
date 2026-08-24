/**
 * Stage 202.6 — Vercel serverless invocation burn: middleware / SSR self-HTTP / CDN headers.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage202-6-vercel-invocation-audit.test.js
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  edgeCacheResponseHeaders,
  retailFxEdgeCacheControl,
  PRIVATE_NO_STORE_CACHE_CONTROL,
} from '../lib/api/public-edge-cache-control.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 202.6 — Vercel invocation audit fixes', () => {
  it('middleware matcher excludes static, sitemap, robots, images', () => {
    const mw = read('middleware.ts')
    assert.match(mw, /sitemap/)
    assert.match(mw, /robots/)
    assert.match(mw, /_next\/static/)
    assert.match(mw, /_next\/image/)
    assert.match(mw, /favicon/)
    assert.match(mw, /webp/)
  })

  it('middleware does not Set-Cookie geo on /api paths', () => {
    const mw = read('middleware.ts')
    assert.match(mw, /do NOT Set-Cookie geo on `\/api\/\*`/)
    // API branch must not call nextWithGeo
    const apiBlock = mw.slice(mw.indexOf("pathname.startsWith('/api/')"), mw.indexOf('const legacy'))
    assert.doesNotMatch(apiBlock, /nextWithGeo/)
  })

  it('referral landing metadata does not self-fetch /api', () => {
    const u = read('app/(storefront)/u/[id]/layout.js')
    const go = read('app/(storefront)/go/[vanity]/layout.js')
    assert.match(u, /getCachedPublicLandingMeta/)
    assert.match(go, /getCachedPublicLandingMeta/)
    assert.doesNotMatch(u, /\/api\/v2\/referral\/landing-meta/)
    assert.doesNotMatch(go, /\/api\/v2\/referral\/landing-meta/)
  })

  it('edgeCacheResponseHeaders sets Vercel-CDN-Cache-Control for public', () => {
    const publicH = edgeCacheResponseHeaders('public, s-maxage=60, stale-while-revalidate=120')
    assert.equal(publicH['Cache-Control'], 'public, s-maxage=60, stale-while-revalidate=120')
    assert.equal(
      publicH['Vercel-CDN-Cache-Control'],
      'public, s-maxage=60, stale-while-revalidate=120',
    )
    const priv = edgeCacheResponseHeaders(PRIVATE_NO_STORE_CACHE_CONTROL)
    assert.equal(priv['Cache-Control'], PRIVATE_NO_STORE_CACHE_CONTROL)
    assert.equal(priv['Vercel-CDN-Cache-Control'], undefined)
  })

  it('retail FX edge cache allows CDN; settlement stays private', () => {
    assert.match(
      retailFxEdgeCacheControl({ applyRetailMarkup: true, status: 200 }),
      /s-maxage=60/,
    )
    assert.equal(
      retailFxEdgeCacheControl({ applyRetailMarkup: false, status: 200 }),
      PRIVATE_NO_STORE_CACHE_CONTROL,
    )
  })

  it('health and exchange-rates GET emit CDN headers', () => {
    assert.match(read('app/api/health/route.js'), /Vercel-CDN-Cache-Control/)
    assert.match(read('app/api/v2/exchange-rates/route.js'), /retailFxEdgeCacheControl/)
  })
})
