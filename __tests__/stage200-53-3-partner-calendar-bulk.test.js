/**
 * Stage 200.53.3 — partner calendar bulk raw loader helpers.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-53-3-partner-calendar-bulk.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.53.3 — partner-calendar-bulk-load', () => {
  it('groupRowsByListingId buckets by listing_id', async () => {
    const { groupRowsByListingId, normalizeListingIds, emptyPartnerCalendarRawMaps } = await import(
      '@/lib/services/calendar/partner-calendar-bulk-load.js'
    )

    assert.deepEqual(normalizeListingIds(['a', 'a', '', null, 'b']), ['a', 'b'])

    const map = groupRowsByListingId([
      { listing_id: 'L1', id: 1 },
      { listing_id: 'L2', id: 2 },
      { listing_id: 'L1', id: 3 },
      { id: 4 },
    ])
    assert.equal(map.get('L1').length, 2)
    assert.equal(map.get('L2').length, 1)
    assert.equal(map.has('L3'), false)

    const empty = emptyPartnerCalendarRawMaps()
    assert.equal(empty.bookingsByListingId.size, 0)
    assert.equal(empty.blocksByListingId.size, 0)
    assert.equal(empty.seasonalByListingId.size, 0)
  })

  it('loadPartnerCalendarRaw with empty ids skips DB (no queries)', async () => {
    const { loadPartnerCalendarRaw } = await import(
      '@/lib/services/calendar/partner-calendar-bulk-load.js'
    )
    let called = 0
    const fake = {
      from() {
        called += 1
        throw new Error('should not query')
      },
    }
    const raw = await loadPartnerCalendarRaw({
      listingIds: [],
      rangeStart: '2026-08-01',
      rangeEnd: '2026-08-31',
      supabase: fake,
    })
    assert.equal(called, 0)
    assert.equal(raw.bookingsByListingId.size, 0)
  })

  it('loadPartnerCalendarRaw issues exactly 3 from() queries and groups rows', async () => {
    const { loadPartnerCalendarRaw } = await import(
      '@/lib/services/calendar/partner-calendar-bulk-load.js'
    )

    const calls = []
    function makeChain(table, rows) {
      const state = { table, filters: [] }
      const chain = {
        select() {
          return chain
        },
        in(col, vals) {
          state.filters.push({ op: 'in', col, vals })
          return chain
        },
        gte(col, v) {
          state.filters.push({ op: 'gte', col, v })
          return chain
        },
        lte(col, v) {
          state.filters.push({ op: 'lte', col, v })
          return chain
        },
        order() {
          return chain
        },
        then(onFulfilled, onRejected) {
          calls.push(state.table)
          return Promise.resolve({ data: rows, error: null }).then(onFulfilled, onRejected)
        },
      }
      return chain
    }

    const fake = {
      from(table) {
        if (table === 'bookings') {
          return makeChain(table, [
            { listing_id: 'A', id: 'b1' },
            { listing_id: 'B', id: 'b2' },
          ])
        }
        if (table === 'calendar_blocks') {
          return makeChain(table, [{ listing_id: 'A', id: 'blk1' }])
        }
        if (table === 'seasonal_prices') {
          return makeChain(table, [
            { listing_id: 'B', id: 's1' },
            { listing_id: 'B', id: 's2' },
          ])
        }
        throw new Error(`unexpected table ${table}`)
      },
    }

    const raw = await loadPartnerCalendarRaw({
      listingIds: ['A', 'B'],
      rangeStart: '2026-08-01',
      rangeEnd: '2026-08-10',
      supabase: fake,
    })

    assert.deepEqual(calls.sort(), ['bookings', 'calendar_blocks', 'seasonal_prices'].sort())
    assert.equal(raw.bookingsByListingId.get('A').length, 1)
    assert.equal(raw.bookingsByListingId.get('B').length, 1)
    assert.equal(raw.blocksByListingId.get('A').length, 1)
    assert.equal(raw.blocksByListingId.get('B').length, 0)
    assert.equal(raw.seasonalByListingId.get('B').length, 2)
    assert.equal(raw.seasonalByListingId.get('A').length, 0)
  })

  it('partner calendar route uses bulk loader + buildCalendar (no per-listing calendar fetch API)', () => {
    const route = read('app/api/v2/partner/calendar/route.js')
    assert.match(route, /loadPartnerCalendarRaw/)
    assert.match(route, /CalendarService\.buildCalendar/)
    assert.match(route, /mapPartnerCalendarGridRow/)
    assert.match(route, /calendarLoad:\s*'partner-calendar-bulk'/)
    assert.equal(
      (route.match(/getCalendarForDateRange/g) || []).length,
      0,
      'route body must not call getCalendarForDateRange',
    )
  })
})
