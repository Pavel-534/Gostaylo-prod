/**
 * Stage 201.114a — home route defers UnifiedSearchBar + below-fold rails.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-114-home-bundle-lazy.test.js
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('Stage 201.114a — home bundle lazy imports', () => {
  it('home content does not statically import UnifiedSearchBar, ForYouRail, or vanity host', () => {
    const home = read('components/PlatformHomeContent.jsx')
    assert.doesNotMatch(home, /from ['"]@\/components\/search\/UnifiedSearchBar['"]/)
    assert.doesNotMatch(home, /from ['"]@\/components\/recommendations\/ForYouRail['"]/)
    assert.doesNotMatch(
      home,
      /from ['"]@\/components\/referral\/ReferralVanityWelcomeBanner['"]/,
    )
    assert.match(home, /UnifiedSearchBarCompactLazy/)
    assert.match(home, /dynamic\(\s*\(\) => import\(['"]@\/components\/recommendations\/ForYouRail['"]\)/)
    assert.match(home, /ForYouRailSkeleton/)
  })

  it('hero uses lazy search bar SSOT with CLS skeleton', () => {
    const hero = read('components/home/HomeHeroLuxe.jsx')
    assert.doesNotMatch(hero, /from ['"]@\/components\/search\/UnifiedSearchBar['"]/)
    assert.match(hero, /UnifiedSearchBarHeroLazy/)
    assert.match(hero, /prefetchUnifiedSearchBarChunk/)
    const lazy = read('components/search/UnifiedSearchBarLazy.jsx')
    assert.match(lazy, /HomeSearchBarSkeleton/)
    assert.match(lazy, /ssr: true/)
  })
})
