/**
 * Strip legacy moderator marker from display names (historical hack: "[MODERATOR]" in last_name).
 * Role must come from profiles.role only; this is cosmetic cleanup for old rows.
 */
const LEGACY_MODERATOR_SUFFIX = /\s*\[MODERATOR\]\s*/gi

export function stripLegacyModeratorMarker(lastName) {
  if (lastName == null || lastName === '') return ''
  return String(lastName).replace(LEGACY_MODERATOR_SUFFIX, '').trim()
}
