/**
 * Partner decline vs cancel — Postgres `booking_status` has no `DECLINED`.
 * `DECLINED` is UI/i18n only (`lib/config/app-constants.js` → BOOKING_STATUS_CODES excludes it).
 * Partner reject → `CANCELLED` + optional metadata (`declineReasonKey`, …).
 */

/**
 * @param {unknown} row
 */
export function bookingMetadataObject(row) {
  const m = row?.metadata
  return m && typeof m === 'object' && !Array.isArray(m) ? m : {}
}

/**
 * @param {unknown} row
 * @param {string} partnerId
 * @returns {'declined' | 'partner_cancel' | null}
 */
export function classifyPartnerCancelledRow(row, partnerId) {
  if (String(row?.status || '').toUpperCase() !== 'CANCELLED') return null

  const meta = bookingMetadataObject(row)
  const pid = String(partnerId || '')
  const hasDeclineSignal = Boolean(
    meta.declineReasonKey || meta.decline_reason_key || meta.declineReasonDetail,
  )
  const partnerActor = String(meta.cancelled_by_user_id || '') === pid

  if (hasDeclineSignal) return 'declined'
  if (partnerActor) return 'partner_cancel'
  return null
}

/**
 * @param {unknown} row
 */
export function cancelledRowTimestamp(row) {
  const meta = bookingMetadataObject(row)
  return meta.cancelled_at || meta.cancelledAt || row?.updated_at || row?.created_at
}
