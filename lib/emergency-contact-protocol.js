/**
 * Stage 22.0 — Trust & safety: emergency contact checklist + rate-limit helpers.
 */

export const EMERGENCY_CONTACT_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * @param {unknown} body
 * @returns {{ ok: true, checklist: { health_or_safety: boolean, no_property_access: boolean, disaster: boolean } } | { ok: false, error: string }}
 */
export function parseEmergencyChecklistFromBody(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Invalid JSON body' }
  }
  const c = body.checklist && typeof body.checklist === 'object' ? body.checklist : body
  const checklist = {
    health_or_safety: c.health_or_safety === true,
    no_property_access: c.no_property_access === true,
    disaster: c.disaster === true,
  }
  if (!checklist.health_or_safety && !checklist.no_property_access && !checklist.disaster) {
    return { ok: false, error: 'At least one reason must be selected' }
  }
  return { ok: true, checklist }
}

/**
 * @param {Array<unknown>} events
 * @param {number} nowMs
 * @returns {boolean} true if a call was made within the window (blocks new call).
 */
export function hasEmergencyContactWithinWindow(events, nowMs = Date.now()) {
  if (!Array.isArray(events)) return false
  const cutoff = nowMs - EMERGENCY_CONTACT_WINDOW_MS
  for (const e of events) {
    if (!e || typeof e !== 'object') continue
    const at = e.at != null ? new Date(String(e.at)).getTime() : NaN
    if (!Number.isFinite(at) || at < cutoff) continue
    return true
  }
  return false
}

/**
 * @param {Record<string, unknown>} metadata
 */
export function isEmergencyRateLimitExempt(metadata) {
  const m = metadata && typeof metadata === 'object' ? metadata : {}
  return m.emergency_contact_rate_limit_exempt === true
}
