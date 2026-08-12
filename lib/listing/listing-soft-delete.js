/**
 * Stage 200.127 / 200.128 — partner listing soft-delete SSOT (`metadata.is_deleted`).
 * Enum `listing_status` has no DELETED; soft delete = INACTIVE + this flag.
 */

/**
 * @param {object | null | undefined} row — listing row (DB or API)
 * @returns {boolean}
 */
export function isListingSoftDeleted(row) {
  const meta = row?.metadata
  return Boolean(meta && typeof meta === 'object' && !Array.isArray(meta) && meta.is_deleted === true)
}

/**
 * @param {object | null | undefined} row
 * @returns {boolean}
 */
export function isListingNotSoftDeleted(row) {
  return !isListingSoftDeleted(row)
}

/**
 * Filter partner-owned listing arrays for operational UI (calendar, stats, lists).
 * @template T
 * @param {T[] | null | undefined} rows
 * @returns {T[]}
 */
export function filterOutSoftDeletedListings(rows) {
  return (rows || []).filter(isListingNotSoftDeleted)
}

/**
 * Soft-deleted rows only (trash / filter=deleted).
 * @template T
 * @param {T[] | null | undefined} rows
 * @returns {T[]}
 */
export function filterOnlySoftDeletedListings(rows) {
  return (rows || []).filter(isListingSoftDeleted)
}

/**
 * Build sync_settings patch for soft DELETE — pause iCal without losing prior auto_sync.
 * SSOT flags live on sync_settings (alongside auto_sync), not metadata.
 *
 * @param {object | null | undefined} syncSettings
 * @returns {object | null}
 */
export function buildSoftDeleteSyncSettingsPatch(syncSettings) {
  if (!syncSettings || typeof syncSettings !== 'object' || Array.isArray(syncSettings)) {
    return null
  }
  return {
    ...syncSettings,
    auto_sync_before_soft_delete: Boolean(syncSettings.auto_sync),
    auto_sync: false,
    paused_by_soft_delete: true,
  }
}

/**
 * Metadata fields written on soft DELETE (caller merges with previous metadata).
 * @param {{ userId: string, previousStatus: string }} params
 */
export function buildSoftDeleteMetadataFields({ userId, previousStatus }) {
  return {
    is_deleted: true,
    deleted_at: new Date().toISOString(),
    deleted_by: userId,
    previous_status: previousStatus,
  }
}
