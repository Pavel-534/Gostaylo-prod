/**
 * Stage 201.109 — restore waits for layout, then Y; do not drop pending on miss.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-109-scroll-restore-commit.test.js
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  isRouteScrollLayoutReady,
  normalizeScrollAnchorPath,
  resolveRouteScrollRestoreStep,
} from '../lib/navigation/route-scroll-memory.js'

const root = process.cwd()

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('Stage 201.109 — scroll restore commit', () => {
  it('keeps /help/#contact distinct from /help', () => {
    assert.equal(normalizeScrollAnchorPath('/help/#contact'), '/help#contact')
    assert.equal(normalizeScrollAnchorPath('/help/'), '/help')
    assert.notEqual(
      normalizeScrollAnchorPath('/help/#contact'),
      normalizeScrollAnchorPath('/help/'),
    )
  })

  it('waits until layout is tall enough; budget still applies Y', () => {
    const entry = { y: 2400, anchorHref: '/help/#contact', anchorTop: 520 }
    assert.equal(isRouteScrollLayoutReady(entry, 800), false)
    assert.equal(isRouteScrollLayoutReady(entry, 2380), true)

    const waiting = resolveRouteScrollRestoreStep({
      layoutReady: false,
      anchorStable: false,
      budgetExceeded: false,
      hasY: true,
    })
    assert.deepEqual(waiting, { wait: true, applyMode: 'y', commit: false })

    const readyY = resolveRouteScrollRestoreStep({
      layoutReady: true,
      anchorStable: false,
      budgetExceeded: false,
      hasY: true,
    })
    assert.deepEqual(readyY, { wait: false, applyMode: 'y', commit: true })

    const budget = resolveRouteScrollRestoreStep({
      layoutReady: false,
      anchorStable: false,
      budgetExceeded: true,
      hasY: true,
    })
    assert.deepEqual(budget, { wait: false, applyMode: 'y', commit: true })
  })

  it('host does not drop pending before commit, and does not require a stable footer anchor', () => {
    const host = read('components/navigation/RouteScrollMemoryHost.jsx')
    assert.match(host, /resolveRouteScrollRestoreStep/)
    assert.match(host, /if \(step\.wait\) return false/)
    assert.doesNotMatch(
      host,
      /activeEntry = entry\s+pendingPopRestoreRef\.current = false/,
    )
    assert.doesNotMatch(host, /finishMiss\(\)/)
  })
})
