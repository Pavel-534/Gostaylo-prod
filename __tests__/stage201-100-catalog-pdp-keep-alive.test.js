/**
 * Stage 201.100 — catalog ↔ PDP: park list on PDP, no View Transition around router.push.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-100-catalog-pdp-keep-alive.test.js
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  isStorefrontCatalogListPath,
  isStorefrontListingPdpPath,
  isStorefrontSearchKeepAlivePath,
} from '@/lib/navigation/storefront-search-keep-alive.js'
import { navigateWithListingHeroTransition } from '@/lib/navigation/listing-hero-transition.js'

const root = process.cwd()

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('Stage 201.100 — catalog ↔ PDP keep-alive', () => {
  it('parks Home + catalog on listing PDP, not messages', () => {
    assert.equal(isStorefrontCatalogListPath('/listings'), true)
    assert.equal(isStorefrontListingPdpPath('/listings/yamaha-1'), true)
    assert.equal(isStorefrontListingPdpPath('/listings'), false)
    assert.equal(isStorefrontSearchKeepAlivePath('/listings/yamaha-1'), true)
    assert.equal(isStorefrontSearchKeepAlivePath('/messages'), false)
  })

  it('does not wrap App Router navigation in startViewTransition', () => {
    const hero = read('lib/navigation/listing-hero-transition.js')
    assert.doesNotMatch(hero, /startViewTransition\(\s*\(\)\s*=>/)
    const nav = hero.match(
      /export function navigateWithListingHeroTransition\([\s\S]*?\n\}/,
    )
    assert.ok(nav)
    assert.match(nav[0], /prepareListingPdpNavigation\(href\)/)
    assert.match(nav[0], /navigate\(\)/)
    let navigated = false
    navigateWithListingHeroTransition(() => {
      navigated = true
    }, 'id-1', '/listings/id-1')
    assert.equal(navigated, true)
  })

  it('catalog card Link is not preventDefault + router.push', () => {
    const carousel = read('components/card/CardImageCarousel.jsx')
    assert.match(carousel, /prepareListingPdpNavigation/)
    const nav = carousel.match(/const handleDetailNavigate = useCallback\([\s\S]*?\n  \)/)
    assert.ok(nav)
    assert.doesNotMatch(nav[0], /preventDefault/)
    assert.doesNotMatch(nav[0], /router\.push/)
  })

  it('keep-alive pane keeps catalog behind PDP and resets scroll on leave', () => {
    const pane = read('components/navigation/StorefrontSearchKeepAlive.jsx')
    assert.match(pane, /catalogBehindPdp/)
    assert.match(pane, /isStorefrontListingPdpPath/)
    assert.match(pane, /window\.scrollTo\(0, 0\)/)
  })
})
