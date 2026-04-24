/** Stage 39.0 — dynamic Flash strip: bookings social proof vs expiry countdown (6h threshold). */

export const FLASH_HOT_STRIP_SIX_H_MS = 6 * 60 * 60 * 1000

/**
 * @param {number} remainingMs
 * @returns {string} ЧЧ:ММ (total hours may exceed 23)
 */
export function formatFlashRemainingHoursMinutes(remainingMs) {
  const totalMin = Math.max(0, Math.floor(remainingMs / 60000))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * @param {{ ends_at?: string } | null} catalog_flash_urgency
 * @param {{ bookingsCreatedCount?: number } | null} catalog_flash_social_proof
 * @param {number} [nowMs]
 * @returns {{ kind: 'bookings_today'; count: number } | { kind: 'expires_soon'; remainingMs: number; hm: string } | null}
 */
export function resolveFlashHotStripState(catalog_flash_urgency, catalog_flash_social_proof, nowMs = Date.now()) {
  const endsAt = catalog_flash_urgency?.ends_at
  if (!endsAt) return null
  const endMs = new Date(String(endsAt)).getTime()
  if (!Number.isFinite(endMs) || endMs <= nowMs) return null
  const remainingMs = endMs - nowMs
  if (remainingMs > FLASH_HOT_STRIP_SIX_H_MS) {
    const count = Number(catalog_flash_social_proof?.bookingsCreatedCount) || 0
    if (count <= 0) return null
    return { kind: 'bookings_today', count }
  }
  return {
    kind: 'expires_soon',
    remainingMs,
    hm: formatFlashRemainingHoursMinutes(remainingMs),
  }
}

/**
 * When false, show {@link UrgencyTimer} above the strip (no duplicate countdown in strip).
 */
export function shouldShowFlashUrgencyTimerAboveStrip(
  catalog_flash_urgency,
  catalog_flash_social_proof,
  nowMs = Date.now(),
) {
  const st = resolveFlashHotStripState(catalog_flash_urgency, catalog_flash_social_proof, nowMs)
  if (st?.kind === 'expires_soon') return false
  return Boolean(catalog_flash_urgency?.ends_at)
}
