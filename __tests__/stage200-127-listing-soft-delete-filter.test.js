/**
 * Stage 200.127 — soft-delete SSOT filters (calendar / stats / iCal / list).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-127-listing-soft-delete-filter.test.js
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  filterOutSoftDeletedListings,
  isListingNotSoftDeleted,
  isListingSoftDeleted,
} from '@/lib/listing/listing-soft-delete.js'

const root = process.cwd()

describe('Stage 200.127 — listing soft-delete filter', () => {
  it('SSOT helpers treat metadata.is_deleted', () => {
    assert.equal(isListingSoftDeleted({ metadata: { is_deleted: true } }), true)
    assert.equal(isListingNotSoftDeleted({ metadata: { is_deleted: true } }), false)
    assert.equal(isListingSoftDeleted({ metadata: {} }), false)
    assert.equal(isListingSoftDeleted({ status: 'INACTIVE' }), false)
    assert.deepEqual(
      filterOutSoftDeletedListings([
        { id: 'a', metadata: { is_deleted: true } },
        { id: 'b', metadata: {} },
      ]).map((r) => r.id),
      ['b'],
    )
  })

  it('partner calendar + stats + listings GET use filterOutSoftDeletedListings', () => {
    const cal = readFileSync(join(root, 'app/api/v2/partner/calendar/route.js'), 'utf8')
    const stats = readFileSync(join(root, 'app/api/v2/partner/stats/route.js'), 'utf8')
    const list = readFileSync(join(root, 'app/api/v2/partner/listings/route.js'), 'utf8')
    assert.ok(cal.includes('filterOutSoftDeletedListings'))
    assert.ok(stats.includes('filterOutSoftDeletedListings'))
    assert.ok(list.includes('filterOutSoftDeletedListings'))
  })

  it('ical cron skips soft-deleted; soft DELETE uses sync pause helper', () => {
    const cron = readFileSync(join(root, 'app/api/cron/ical-sync/route.js'), 'utf8')
    const del = readFileSync(join(root, 'app/api/v2/partner/listings/[id]/route.js'), 'utf8')
    const soft = readFileSync(join(root, 'lib/listing/listing-soft-delete.js'), 'utf8')
    assert.ok(cron.includes('isListingNotSoftDeleted'))
    assert.ok(del.includes('buildSoftDeleteSyncSettingsPatch'))
    assert.ok(soft.includes('paused_by_soft_delete'))
    assert.ok(soft.includes('auto_sync_before_soft_delete'))
  })

  it('delete dialog copy is honest (soft remove, not wipe)', () => {
    const i18n = readFileSync(join(root, 'lib/translations/slices/partner-ui.js'), 'utf8')
    assert.ok(i18n.includes('исчезнет из кабинета, календаря и каталога'))
    assert.ok(i18n.includes('Bookings and chat history stay'))
    assert.doesNotMatch(i18n, /Объявление и его данные будут удалены/)
  })
})
