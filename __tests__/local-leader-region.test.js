/**
 * Stage 202.23 — local leader region admin service.
 * Run:
 *   node --import ./scripts/node-test-alias-register.mjs --test __tests__/local-leader-region.test.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const {
  assignRegion,
  clearRegion,
  listAvailableRegions,
} = require('../lib/services/admin/local-leader-region.service.js')
const { isValidRegionId } = require('../lib/config/leader-regions.js')

function createSupabaseMock(profile) {
  const state = {
    profile: {
      id: profile.id,
      metadata: { ...(profile.metadata || {}) },
    },
    updates: [],
  }

  return {
    state,
    from(table) {
      assert.equal(table, 'profiles')
      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  return { data: { ...state.profile }, error: null }
                },
              }
            },
          }
        },
        update(payload) {
          state.updates.push(payload)
          if (payload?.metadata && typeof payload.metadata === 'object') {
            state.profile.metadata = { ...payload.metadata }
          }
          return {
            async eq() {
              return { error: null }
            },
          }
        },
      }
    },
  }
}

describe('Stage 202.23 — local leader region service', () => {
  it('assignRegion writes local_leader_region_id preserving metadata', async () => {
    const db = createSupabaseMock({
      id: 'u1',
      metadata: { some_key: 'x', local_leader_region_id: 'spb' },
    })
    const audits = []
    const res = await assignRegion(db, {
      userId: 'u1',
      regionId: 'phuket',
      adminId: 'admin-1',
      auditFn: async (payload) => audits.push(payload),
    })

    assert.equal(res.ok, true)
    assert.equal(res.previousRegionId, 'spb')
    assert.equal(db.state.profile.metadata.local_leader_region_id, 'phuket')
    assert.equal(db.state.profile.metadata.some_key, 'x')
    assert.equal(audits.length, 1)
    assert.equal(audits[0].action, 'local_leader_region_assign')
    assert.equal(audits[0].payload.beforeRegionId, 'spb')
    assert.equal(audits[0].payload.afterRegionId, 'phuket')
  })

  it('assignRegion rejects unknown region id', async () => {
    const db = createSupabaseMock({ id: 'u1', metadata: {} })
    await assert.rejects(
      () =>
        assignRegion(db, {
          userId: 'u1',
          regionId: 'mars',
          adminId: 'admin-1',
          auditFn: async () => {},
        }),
      /INVALID_REGION_ID/,
    )
  })

  it('clearRegion removes only local_leader_region_id key', async () => {
    const db = createSupabaseMock({
      id: 'u1',
      metadata: { local_leader_region_id: 'phuket', preserve: 'yes' },
    })
    const audits = []
    const res = await clearRegion(db, {
      userId: 'u1',
      adminId: 'admin-1',
      auditFn: async (payload) => audits.push(payload),
    })

    assert.equal(res.ok, true)
    assert.equal(res.previousRegionId, 'phuket')
    assert.equal(db.state.profile.metadata.local_leader_region_id, undefined)
    assert.equal(db.state.profile.metadata.preserve, 'yes')
    assert.equal(audits.length, 1)
    assert.equal(audits[0].action, 'local_leader_region_clear')
    assert.equal(audits[0].payload.beforeRegionId, 'phuket')
    assert.equal(audits[0].payload.afterRegionId, null)
  })

  it('listAvailableRegions returns id + i18nKey rows', () => {
    const rows = listAvailableRegions()
    assert.ok(Array.isArray(rows))
    assert.ok(rows.length >= 10)
    assert.ok(rows.every((r) => typeof r.id === 'string' && typeof r.i18nKey === 'string'))
  })

  it('isValidRegionId validates starter ids', () => {
    assert.equal(isValidRegionId('phuket'), true)
    assert.equal(isValidRegionId('spb'), true)
    assert.equal(isValidRegionId(''), false)
    assert.equal(isValidRegionId('unknown'), false)
  })
})

