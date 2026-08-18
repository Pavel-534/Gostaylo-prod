/**
 * Stage 201.111 — Popular nearby stays visible; Back pins the clicked link until Home is tall.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-111-home-rail-scroll-restore.test.js
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  listingIdsForRailDedupe,
  resolveForYouRailDisplay,
} from '../lib/recommendations/for-you-rail-display.js'
import {
  FOR_YOU_EXCLUDE_FEATURED_HEAD,
  FOR_YOU_MIN_RESULTS,
} from '../lib/recommendations/constants.js'
import {
  isRouteScrollHeightStable,
  isRouteScrollLayoutReady,
  nextRouteScrollHeightStableState,
  resolveRouteScrollRestoreStep,
  ROUTE_SCROLL_HEIGHT_STABLE_TICKS,
} from '../lib/navigation/route-scroll-memory.js'
import { shouldPaintPendingCatalogSkeleton } from '../lib/navigation/pending-catalog-skeleton.js'

const root = process.cwd()

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('Stage 201.111 — popular nearby + growing-home restore', () => {
  it('still shows the rail when every for-you id is also in Top', () => {
    assert.equal(FOR_YOU_EXCLUDE_FEATURED_HEAD, 4)
    const featured = listingIdsForRailDedupe(
      Array.from({ length: 12 }, (_, i) => ({ id: `top-${i + 1}` })),
    )
    const listings = featured.map((id) => ({ id }))
    const shown = resolveForYouRailDisplay(listings, {
      minResults: FOR_YOU_MIN_RESULTS,
      isMobile: false,
      isCatalogXsHidden: false,
      mobileMaxCards: 5,
      excludeListingIds: featured,
    })
    assert.equal(shown.shouldRender, true)
    assert.ok(shown.visible.length >= FOR_YOU_MIN_RESULTS)
    assert.equal(shown.visible[0].id, 'top-5')
  })

  it('reserves rail height while loading; Home Top Back does not hang', () => {
    const rail = read('components/recommendations/ForYouRail.jsx')
    assert.match(rail, /gsl-shimmer/)
    assert.doesNotMatch(rail, /if \(loading\) return null/)
    assert.equal(shouldPaintPendingCatalogSkeleton('/', '/listings/car-1'), false)
    const card = read('components/recommendations/RecommendationRailCard.jsx')
    assert.match(card, /prepareListingPdpNavigation/)
    const capture = read('lib/navigation/catalog-return-href.js')
    assert.match(capture, /clearCatalogReturnHref\(\)/)
  })

  it('does not treat y=0 as layout-ready; pins anchor until height is stable', () => {
    assert.equal(isRouteScrollLayoutReady({ y: 0, anchorHref: '/help/#contact' }, 400), false)
    assert.equal(isRouteScrollLayoutReady({ y: 2400 }, 800), false)

    const pinning = resolveRouteScrollRestoreStep({
      layoutReady: false,
      heightStable: false,
      anchorStable: false,
      budgetExceeded: false,
      hasY: true,
      hasAnchor: true,
    })
    assert.deepEqual(pinning, { wait: true, applyMode: 'anchor', commit: false })

    const tooSoon = resolveRouteScrollRestoreStep({
      layoutReady: true,
      heightStable: false,
      anchorStable: true,
      budgetExceeded: false,
      hasY: true,
      hasAnchor: true,
    })
    assert.deepEqual(tooSoon, { wait: true, applyMode: 'anchor', commit: false })

    const commit = resolveRouteScrollRestoreStep({
      layoutReady: true,
      heightStable: true,
      anchorStable: true,
      budgetExceeded: false,
      hasY: true,
      hasAnchor: true,
    })
    assert.deepEqual(commit, { wait: false, applyMode: 'anchor', commit: true })
  })

  it('needs several unchanged height ticks before commit', () => {
    let state = nextRouteScrollHeightStableState(null, 800)
    assert.equal(isRouteScrollHeightStable(state), false)
    for (let i = 0; i < ROUTE_SCROLL_HEIGHT_STABLE_TICKS - 1; i += 1) {
      state = nextRouteScrollHeightStableState(state, 800)
    }
    assert.equal(isRouteScrollHeightStable(state), true)
    state = nextRouteScrollHeightStableState(state, 2400)
    assert.equal(isRouteScrollHeightStable(state), false)
  })

  it('host pins until heightStable and reads scrollingElement Y', () => {
    const host = read('components/navigation/RouteScrollMemoryHost.jsx')
    assert.match(host, /isRouteScrollHeightStable/)
    assert.match(host, /hasAnchor: Boolean\(activeEntry\.anchorHref\)/)
    assert.match(host, /readWindowScrollY/)
    const memory = read('lib/navigation/route-scroll-memory.js')
    assert.match(memory, /document\.scrollingElement/)
  })
})
