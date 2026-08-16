/**
 * Stage 201.65 — draft save undeletes soft-deleted listing rows.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-65-draft-save-undeletes.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.65 — draft save clears soft-delete', () => {
  it('PUT partner listing clears trash flags when keeping is_draft', () => {
    const route = read('app/api/v2/partner/listings/[id]/route.js')
    assert.match(route, /clearSoftDeleteMetadata/)
    assert.match(route, /wantsDraftKeep/)
    assert.match(route, /buildRestoredSyncSettingsPatch/)
    assert.match(route, /201\.65/)
  })

  it('saveDraft strips soft-delete keys from draft metadata', () => {
    const src = read('app/(partner)/partner/listings/new/hooks/useListingSave.js')
    assert.match(src, /delete draftMeta\.is_deleted/)
    assert.match(src, /draftMeta\.is_deleted = false/)
  })

  it('clearSoftDeleteMetadata removes trash keys', async () => {
    const { clearSoftDeleteMetadata } = await import('../lib/listing/listing-soft-delete-restore.js')
    const next = clearSoftDeleteMetadata({
      is_draft: true,
      is_deleted: true,
      deleted_at: '2026-08-16T00:00:00.000Z',
      deleted_by: 'user-x',
      title_hint: 'keep',
    })
    assert.equal(next.is_draft, true)
    assert.equal(next.title_hint, 'keep')
    assert.equal(Object.prototype.hasOwnProperty.call(next, 'is_deleted'), false)
    assert.equal(Object.prototype.hasOwnProperty.call(next, 'deleted_at'), false)
  })
})
