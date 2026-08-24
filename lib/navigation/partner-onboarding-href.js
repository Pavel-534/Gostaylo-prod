/**
 * Stage 202.8 — guest «Стать партнёром» must not deep-link into middleware-guarded `/partner/*`.
 * Application UX lives on renter profile; cabinet is for approved PARTNER roles only.
 */

/** Open partner application (login → form). */
export const PARTNER_ONBOARDING_HREF = '/renter/profile?becomePartner=1'

/** Approved partner workspace. */
export const PARTNER_CABINET_HREF = '/partner/dashboard'

/**
 * @param {string | null | undefined} role
 * @returns {boolean}
 */
export function isPartnerCabinetRole(role) {
  const r = String(role || '').toUpperCase()
  return r === 'PARTNER' || r === 'ADMIN' || r === 'MODERATOR'
}
