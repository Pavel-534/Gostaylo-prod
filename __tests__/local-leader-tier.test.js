/**
 * Stage 202.22 — Local Leader tier computation.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/local-leader-tier.test.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const {
  computeLocalLeaderTier,
  progressToNextTier,
} = require('../lib/services/marketing/local-leader-tier.service.js')
const { LEADER_TIERS } = require('../lib/config/leader-tier-thresholds.js')

describe('Stage 202.22 — local leader tier', () => {
  it('0 metrics → participant with activist next', () => {
    const { current, next } = computeLocalLeaderTier({})
    assert.equal(current.id, 'participant')
    assert.equal(next?.id, 'activist')
  })

  it('1 qualified host → activist', () => {
    const { current } = computeLocalLeaderTier({ qualifiedHostsCount: 1 })
    assert.equal(current.id, 'activist')
  })

  it('3 qualified + 1 host booking → mentor', () => {
    const { current } = computeLocalLeaderTier({
      qualifiedHostsCount: 3,
      completedBookingsAsHost: 1,
    })
    assert.equal(current.id, 'mentor')
  })

  it('10 qualified + 5 host bookings + 1000 THB → leader', () => {
    const { current, next } = computeLocalLeaderTier({
      qualifiedHostsCount: 10,
      completedBookingsAsHost: 5,
      earnedThb: 1000,
    })
    assert.equal(current.id, 'leader')
    assert.equal(next?.id, 'regional_leader')
  })

  it('leader metrics + region → regional_leader; without region stays leader', () => {
    const base = {
      qualifiedHostsCount: 10,
      completedBookingsAsHost: 5,
      earnedThb: 1000,
    }
    assert.equal(computeLocalLeaderTier({ ...base, regionAssigned: false }).current.id, 'leader')
    assert.equal(computeLocalLeaderTier({ ...base, regionAssigned: true }).current.id, 'regional_leader')
  })

  it('progressToNextTier uses bottleneck ratio across three metrics', () => {
    const next = LEADER_TIERS.find((t) => t.id === 'leader')
    const { percent, missing } = progressToNextTier(next, {
      qualifiedHostsCount: 5,
      completedBookingsAsHost: 5,
      earnedThb: 500,
      regionAssigned: false,
    })
    assert.equal(missing.qualifiedHosts, 5)
    assert.equal(missing.earnedThb, 500)
    assert.equal(percent, 50)
  })

  it('progressToNextTier includes region gate for regional_leader', () => {
    const next = LEADER_TIERS.find((t) => t.id === 'regional_leader')
    const { percent, missing } = progressToNextTier(next, {
      qualifiedHostsCount: 10,
      completedBookingsAsHost: 5,
      earnedThb: 1000,
      regionAssigned: false,
    })
    assert.equal(missing.regionAssignment, true)
    assert.equal(percent, 0)
  })
})
