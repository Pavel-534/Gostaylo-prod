/**
 * Stage 200.128 — resolve soft-delete Restore patch (status + metadata + iCal sync).
 * No PricingEngine / ledger / bookings mutations.
 */

import { isListingSoftDeleted } from '@/lib/listing/listing-soft-delete.js'

const RESTORE_STATUS_ALLOW = new Set(['ACTIVE', 'PENDING', 'REJECTED', 'INACTIVE'])

/**
 * Map stored previous_status → listing.status after undelete.
 * BOOKED (legacy/rare) → ACTIVE. Unknown → INACTIVE.
 *
 * @param {unknown} previousStatus
 * @returns {'ACTIVE'|'PENDING'|'REJECTED'|'INACTIVE'}
 */
export function resolveRestoredListingStatus(previousStatus) {
  const raw = String(previousStatus || '')
    .trim()
    .toUpperCase()
  if (raw === 'BOOKED') return 'ACTIVE'
  if (RESTORE_STATUS_ALLOW.has(raw)) return /** @type {'ACTIVE'|'PENDING'|'REJECTED'|'INACTIVE'} */ (raw)
  return 'INACTIVE'
}

/**
 * Clear soft-delete flags from metadata (keeps partner_hidden, is_draft, etc.).
 * @param {object | null | undefined} metadata
 * @returns {object}
 */
export function clearSoftDeleteMetadata(metadata) {
  const prev =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? { ...metadata } : {}
  delete prev.is_deleted
  delete prev.deleted_at
  delete prev.deleted_by
  // previous_status kept for audit trail
  return prev
}

/**
 * Restore iCal auto_sync only when we paused it on soft-delete.
 * Legacy rows without auto_sync_before_soft_delete → auto_sync stays false.
 *
 * @param {object | null | undefined} syncSettings
 * @returns {object | null} null = leave sync_settings unchanged
 */
export function buildRestoredSyncSettingsPatch(syncSettings) {
  if (!syncSettings || typeof syncSettings !== 'object' || Array.isArray(syncSettings)) {
    return null
  }
  if (syncSettings.paused_by_soft_delete !== true) {
    return null
  }
  const next = { ...syncSettings }
  const prior =
    typeof next.auto_sync_before_soft_delete === 'boolean'
      ? next.auto_sync_before_soft_delete
      : false
  next.auto_sync = prior
  delete next.paused_by_soft_delete
  delete next.auto_sync_before_soft_delete
  return next
}

/**
 * Full DB update payload for partner listing restore.
 *
 * @param {object} listing — DB row with metadata, sync_settings, status
 * @returns {{
 *   ok: true,
 *   status: string,
 *   available: boolean | undefined,
 *   metadata: object,
 *   sync_settings: object | null | undefined,
 * } | { ok: false, code: string, error: string }}
 */
export function buildListingSoftDeleteRestorePatch(listing) {
  if (!listing) {
    return { ok: false, code: 'LISTING_NOT_FOUND', error: 'Listing not found' }
  }
  if (!isListingSoftDeleted(listing)) {
    return {
      ok: false,
      code: 'NOT_SOFT_DELETED',
      error: 'Listing is not in the deleted trash',
    }
  }

  const meta = listing.metadata && typeof listing.metadata === 'object' ? listing.metadata : {}
  const status = resolveRestoredListingStatus(meta.previous_status)
  const metadata = clearSoftDeleteMetadata(meta)
  const syncPatch = buildRestoredSyncSettingsPatch(listing.sync_settings)

  /** @type {{ ok: true, status: string, available?: boolean, metadata: object, sync_settings?: object | null }} */
  const patch = {
    ok: true,
    status,
    metadata,
  }

  if (status === 'ACTIVE') {
    patch.available = true
  }

  if (syncPatch) {
    patch.sync_settings = syncPatch
  }

  return patch
}
