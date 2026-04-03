/**
 * Canonical privacy-safe display names: first name + last initial.
 * Integrates legacy moderator marker cleanup from profiles.last_name.
 */

import { stripLegacyModeratorMarker } from '@/lib/auth/display-name'

/**
 * @param {string|null|undefined} firstName
 * @param {string|null|undefined} lastName
 * @returns {string} e.g. "Pavel S." or "Pavel" or "Guest"
 */
export function formatPrivacyDisplayName(firstName, lastName) {
  const first = typeof firstName === 'string' ? firstName.trim() : ''
  if (!first) return 'Guest'
  const cleanedLast = stripLegacyModeratorMarker(lastName)
  const last = typeof cleanedLast === 'string' ? cleanedLast.trim() : ''
  if (!last) return first
  const initial = last[0]
  return `${first} ${initial}.`
}

/**
 * Same privacy rule, but when first name is missing fall back to email then label (chat / invoices).
 */
export function formatPrivacyDisplayNameForParticipant(firstName, lastName, email, fallbackLabel = 'User') {
  const first = typeof firstName === 'string' ? firstName.trim() : ''
  if (!first) {
    const e = typeof email === 'string' ? email.trim() : ''
    return e || fallbackLabel
  }
  return formatPrivacyDisplayName(firstName, lastName)
}

/**
 * Avatar / badge initial from first name (after trim).
 */
export function formatReviewerInitial(firstName) {
  const first = typeof firstName === 'string' ? firstName.trim() : ''
  const ch = first[0]
  return ch ? ch.toUpperCase() : 'G'
}
