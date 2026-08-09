/**
 * Stage 200.80 — partner response SLA for PENDING / INQUIRY (calm guest deadline copy + cron SSOT).
 */

/** Hours from booking `created_at` until auto-cancel of unanswered PENDING/INQUIRY. */
export const PARTNER_RESPONSE_SLA_HOURS = 24

/**
 * @param {string | number | Date | null | undefined} createdAt
 * @param {number} [slaHours]
 * @returns {string | null} ISO expiry
 */
export function resolvePartnerResponseExpiresAtIso(
  createdAt,
  slaHours = PARTNER_RESPONSE_SLA_HOURS,
) {
  if (createdAt == null || String(createdAt).trim() === '') return null
  const baseMs = Date.parse(String(createdAt))
  const hours = Number(slaHours)
  if (!Number.isFinite(baseMs) || !Number.isFinite(hours) || hours <= 0) return null
  return new Date(baseMs + hours * 60 * 60 * 1000).toISOString()
}

/**
 * Localised short deadline for guest UI (e.g. «10 авг, 15:00»). Call on client after mount to avoid TZ hydration drift.
 * @param {string | null | undefined} expiresAtIso
 * @param {string} [language]
 * @returns {string | null}
 */
export function formatPartnerResponseDeadlineLabel(expiresAtIso, language = 'ru') {
  if (!expiresAtIso) return null
  const ms = Date.parse(String(expiresAtIso))
  if (!Number.isFinite(ms)) return null
  const lang = String(language || 'ru').toLowerCase().slice(0, 2)
  const locale =
    lang === 'ru' ? 'ru-RU' : lang === 'zh' ? 'zh-CN' : lang === 'th' ? 'th-TH' : 'en-US'
  try {
    return new Date(ms).toLocaleString(locale, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return null
  }
}
