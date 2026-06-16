/**
 * Stage 149.2 — SSOT: host payout profile readiness (onboarding + booking gate).
 */

/**
 * @param {object | null | undefined} profile — row from partner_payout_profiles
 * @returns {boolean}
 */
export function isPartnerPayoutProfileReady(profile) {
  if (!profile) return false
  if (profile.is_verified === true) return true
  const d = profile.data && typeof profile.data === 'object' ? profile.data : {}
  return Object.values(d).some((v) => v != null && String(v).trim() !== '')
}
