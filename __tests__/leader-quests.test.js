/**
 * Stage 202.22 — Leader quests progress.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/leader-quests.test.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const {
  LEADER_QUESTS,
  LEADER_QUEST_MAX_REWARD_THB,
  computeQuestsProgress,
} = require('../lib/services/marketing/quest-progress.service.js')

describe('Stage 202.22 — leader quests', () => {
  it('all quests rewardThb ≤ 100', () => {
    for (const q of LEADER_QUESTS) {
      assert.ok(q.rewardThb <= LEADER_QUEST_MAX_REWARD_THB, q.id)
    }
  })

  it('first_invite met when directInvitesCount >= 1', () => {
    const rows = computeQuestsProgress({ directInvitesCount: 1 })
    const q = rows.find((r) => r.id === 'first_invite')
    assert.equal(q.conditionMet, true)
    assert.equal(q.status, 'condition_met')
  })

  it('first_booking met when bookingsViaRefCount >= 1', () => {
    const rows = computeQuestsProgress({ bookingsViaRefCount: 1 })
    const q = rows.find((r) => r.id === 'first_booking')
    assert.equal(q.conditionMet, true)
  })

  it('three_hosts_30d met when qualifiedHostsLast30d >= 3', () => {
    const rows = computeQuestsProgress({ qualifiedHostsLast30d: 3 })
    const q = rows.find((r) => r.id === 'three_hosts_30d')
    assert.equal(q.conditionMet, true)
  })

  it('first_completed_host met when completedBookingsAsHost >= 1', () => {
    const rows = computeQuestsProgress({ completedBookingsAsHost: 1 })
    const q = rows.find((r) => r.id === 'first_completed_host')
    assert.equal(q.conditionMet, true)
  })
})
