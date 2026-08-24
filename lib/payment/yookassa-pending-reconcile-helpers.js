/**
 * Stage 202.7 — pure helpers for YooKassa INITIATED poll (no DB / PSP imports).
 */

/** Avoid racing the live webhook right after redirect. */
export const YOOKASSA_PENDING_MIN_AGE_MS = 2 * 60 * 1000

/** Stop polling ancient intents (guest abandoned checkout). */
export const YOOKASSA_PENDING_MAX_AGE_MS = 72 * 60 * 60 * 1000

/**
 * @param {string | null | undefined} externalRef
 * @param {object | null | undefined} metadata
 * @returns {string | null}
 */
export function resolveYookassaPaymentIdFromIntent(externalRef, metadata = {}) {
  const meta = metadata && typeof metadata === 'object' ? metadata : {}
  const payload =
    meta.provider_payload && typeof meta.provider_payload === 'object' ? meta.provider_payload : {}
  const candidates = [
    meta.yookassa_payment_id,
    payload.yookassa_payment_id,
    externalRef,
  ]
  for (const raw of candidates) {
    const id = String(raw || '').trim()
    if (!id) continue
    if (/mock|fallback|pay\.mock/i.test(id)) continue
    // YooKassa payment ids are UUID-like; skip checkout URLs
    if (id.includes('://')) continue
    if (id.length < 8) continue
    return id
  }
  return null
}

/**
 * @param {string | null | undefined} iso
 * @param {number} nowMs
 * @param {{ minAgeMs?: number, maxAgeMs?: number }} [opts]
 */
export function isIntentAgeEligibleForYookassaPoll(
  iso,
  nowMs = Date.now(),
  { minAgeMs = YOOKASSA_PENDING_MIN_AGE_MS, maxAgeMs = YOOKASSA_PENDING_MAX_AGE_MS } = {},
) {
  const t = Date.parse(String(iso || ''))
  if (!Number.isFinite(t)) return false
  const age = nowMs - t
  return age >= minAgeMs && age <= maxAgeMs
}
