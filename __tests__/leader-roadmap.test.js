/**
 * Stage 202.22 — Leader roadmap static list.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/leader-roadmap.test.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const { LEADER_ROADMAP } = require('../lib/services/marketing/leader-roadmap.service.js')
const roadmapI18n = fs.readFileSync(
  path.join(process.cwd(), 'lib/translations/slices/leader-roadmap.js'),
  'utf8',
)

describe('Stage 202.22 — leader roadmap', () => {
  it('all items have unique id', () => {
    const ids = LEADER_ROADMAP.map((i) => i.id)
    assert.equal(new Set(ids).size, ids.length)
  })

  it('all items have non-empty i18nKey and descKey', () => {
    for (const item of LEADER_ROADMAP) {
      assert.ok(String(item.i18nKey || '').length > 0)
      assert.ok(String(item.descKey || '').length > 0)
    }
  })

  it('roadmap desc copy has no monetary promises (THB/₽/бат)', () => {
    const moneyPattern = /THB|₽|батт|бат\b/i
    for (const item of LEADER_ROADMAP) {
      const block = roadmapI18n.split(`${item.descKey}:`)[1]?.slice(0, 400) || ''
      assert.doesNotMatch(block, moneyPattern, item.descKey)
    }
  })
})
