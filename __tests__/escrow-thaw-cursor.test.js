/**
 * AUDIT_03 C3.10 — thaw cursor page helper.
 * Run: node --test __tests__/escrow-thaw-cursor.test.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

function nextThawCursor(rows, pageSize) {
  if (!rows?.length) return { done: true, lastId: null }
  const lastId = rows[rows.length - 1].id
  return { done: rows.length < pageSize, lastId }
}

describe('escrow thaw cursor', () => {
  it('continues while full page', () => {
    const rows = Array.from({ length: 1000 }, (_, i) => ({ id: `b-${String(i).padStart(4, '0')}` }))
    const r = nextThawCursor(rows, 1000)
    assert.equal(r.done, false)
    assert.equal(r.lastId, 'b-0999')
  })

  it('stops on short page', () => {
    const r = nextThawCursor([{ id: 'a' }, { id: 'b' }], 1000)
    assert.equal(r.done, true)
    assert.equal(r.lastId, 'b')
  })
})
