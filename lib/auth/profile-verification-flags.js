/**
 * Stage 202.13 — email login gate vs admin KYC (profiles.verification_status).
 */

/**
 * Email confirmed for login (is_verified and/or email_verified_at).
 * @param {{ is_verified?: boolean, email_verified_at?: string | null } | null | undefined} profile
 */
export function profileHasEmailVerified(profile) {
  if (!profile || typeof profile !== 'object') return false
  if (profile.is_verified === true) return true
  return Boolean(profile.email_verified_at)
}

/**
 * Admin KYC / trust badge / payout gate — not email click alone.
 * @param {{ verification_status?: string | null } | null | undefined} profile
 */
export function profileHasAdminKycVerified(profile) {
  if (!profile || typeof profile !== 'object') return false
  return String(profile.verification_status || '').trim().toUpperCase() === 'VERIFIED'
}
