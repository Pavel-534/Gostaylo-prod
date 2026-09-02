/**
 * Stage 202.35 — RF-only public market scope (reversible env).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage202-35-public-market-scope.test.js
 */

const { describe, it, afterEach } = require('node:test')
const assert = require('node:assert/strict')

describe('Stage 202.35 — public market scope', () => {
  const prev = process.env.NEXT_PUBLIC_PUBLIC_MARKET_SCOPE

  afterEach(() => {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_PUBLIC_MARKET_SCOPE
    else process.env.NEXT_PUBLIC_PUBLIC_MARKET_SCOPE = prev
  })

  it('defaults to global destination groups', async () => {
    delete process.env.NEXT_PUBLIC_PUBLIC_MARKET_SCOPE
    const mod = await import('../lib/locations/popular-destinations.js')
    assert.ok(mod.POPULAR_DESTINATION_GROUPS.some((g) => g.id === 'thailand'))
  })

  it('rf-only hides Thailand/world chips', async () => {
    process.env.NEXT_PUBLIC_PUBLIC_MARKET_SCOPE = 'rf-only'
    const { filterDestinationGroupsForPublicScope } = await import(
      '../lib/compliance/public-market-scope.js'
    )
    const { POPULAR_DESTINATION_GROUPS_ALL } = await import('../lib/locations/popular-destinations.js')
    const scoped = filterDestinationGroupsForPublicScope(POPULAR_DESTINATION_GROUPS_ALL)
    assert.deepEqual(
      scoped.map((g) => g.id),
      ['russia'],
    )
    assert.ok(POPULAR_DESTINATION_GROUPS_ALL.some((g) => g.id === 'thailand'))
  })
})
