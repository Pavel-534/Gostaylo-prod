/**
 * Stage 200.128 — listing soft-delete restore + trash UX.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-128-listing-restore.test.js
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildSoftDeleteSyncSettingsPatch,
  filterOnlySoftDeletedListings,
  filterOutSoftDeletedListings,
} from '@/lib/listing/listing-soft-delete.js'
import {
  buildListingSoftDeleteRestorePatch,
  buildRestoredSyncSettingsPatch,
  resolveRestoredListingStatus,
} from '@/lib/listing/listing-soft-delete-restore.js'

const root = process.cwd()

describe('Stage 200.128 — listing restore', () => {
  it('resolves restored status from previous_status (ACTIVE without re-moderation)', () => {
    assert.equal(resolveRestoredListingStatus('ACTIVE'), 'ACTIVE')
    assert.equal(resolveRestoredListingStatus('PENDING'), 'PENDING')
    assert.equal(resolveRestoredListingStatus('REJECTED'), 'REJECTED')
    assert.equal(resolveRestoredListingStatus('INACTIVE'), 'INACTIVE')
    assert.equal(resolveRestoredListingStatus('BOOKED'), 'ACTIVE')
    assert.equal(resolveRestoredListingStatus(''), 'INACTIVE')
  })

  it('DELETE sync patch stores auto_sync_before_soft_delete', () => {
    const patch = buildSoftDeleteSyncSettingsPatch({
      auto_sync: true,
      sources: [{ url: 'https://example.com/a.ics' }],
    })
    assert.equal(patch.auto_sync, false)
    assert.equal(patch.paused_by_soft_delete, true)
    assert.equal(patch.auto_sync_before_soft_delete, true)
  })

  it('RESTORE restores auto_sync only when paused_by_soft_delete', () => {
    const restored = buildRestoredSyncSettingsPatch({
      auto_sync: false,
      paused_by_soft_delete: true,
      auto_sync_before_soft_delete: true,
      sources: [],
    })
    assert.equal(restored.auto_sync, true)
    assert.equal(restored.paused_by_soft_delete, undefined)
    assert.equal(restored.auto_sync_before_soft_delete, undefined)

    const legacy = buildRestoredSyncSettingsPatch({
      auto_sync: false,
      paused_by_soft_delete: true,
    })
    assert.equal(legacy.auto_sync, false)

    assert.equal(buildRestoredSyncSettingsPatch({ auto_sync: false }), null)
  })

  it('buildListingSoftDeleteRestorePatch clears is_deleted and sets ACTIVE+available', () => {
    const patch = buildListingSoftDeleteRestorePatch({
      metadata: {
        is_deleted: true,
        deleted_at: '2026-08-01T00:00:00.000Z',
        deleted_by: 'u1',
        previous_status: 'ACTIVE',
        partner_hidden: false,
      },
      sync_settings: {
        auto_sync: false,
        paused_by_soft_delete: true,
        auto_sync_before_soft_delete: true,
      },
    })
    assert.equal(patch.ok, true)
    assert.equal(patch.status, 'ACTIVE')
    assert.equal(patch.available, true)
    assert.equal(patch.metadata.is_deleted, undefined)
    assert.equal(patch.sync_settings.auto_sync, true)

    const notDeleted = buildListingSoftDeleteRestorePatch({ metadata: {} })
    assert.equal(notDeleted.ok, false)
    assert.equal(notDeleted.code, 'NOT_SOFT_DELETED')
  })

  it('list filters split active vs trash', () => {
    const rows = [
      { id: 'a', metadata: { is_deleted: true } },
      { id: 'b', metadata: {} },
    ]
    assert.deepEqual(filterOutSoftDeletedListings(rows).map((r) => r.id), ['b'])
    assert.deepEqual(filterOnlySoftDeletedListings(rows).map((r) => r.id), ['a'])
  })

  it('wiring: restore route, GET filter, undelete UI keys', () => {
    const restore = readFileSync(
      join(root, 'app/api/v2/partner/listings/[id]/restore/route.js'),
      'utf8',
    )
    const list = readFileSync(join(root, 'app/api/v2/partner/listings/route.js'), 'utf8')
    const del = readFileSync(join(root, 'app/api/v2/partner/listings/[id]/route.js'), 'utf8')
    const page = readFileSync(join(root, 'app/(partner)/partner/listings/page.js'), 'utf8')
    const actions = readFileSync(
      join(root, 'components/partner/listings/PartnerListingCardActions.jsx'),
      'utf8',
    )
    const hooks = readFileSync(join(root, 'lib/hooks/use-partner-listings.js'), 'utf8')
    const i18n = readFileSync(join(root, 'lib/translations/slices/partner-ui.js'), 'utf8')

    assert.ok(restore.includes('buildListingSoftDeleteRestorePatch'))
    assert.ok(list.includes('filterOnlySoftDeletedListings'))
    assert.ok(list.includes("filter === 'deleted'"))
    assert.ok(del.includes('buildSoftDeleteSyncSettingsPatch'))
    assert.ok(page.includes("id: 'deleted'"))
    assert.ok(page.includes('usePartnerListingRestore'))
    assert.ok(page.includes('showUndeleteCta={trashMode}'))
    assert.ok(actions.includes('partnerListings_undelete'))
    assert.ok(actions.includes('onUndelete'))
    assert.ok(actions.includes('data-testid={`undelete-btn-${listing.id}`}'))
    assert.ok(hooks.includes('usePartnerListingRestore'))
    assert.ok(i18n.includes('partnerListings_filterDeleted'))
    assert.ok(i18n.includes('partnerListings_undelete:'))
  })
})
