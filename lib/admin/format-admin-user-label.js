/**
 * Stage 118.0 — человекочитаемая подпись пользователя в админ-таблицах.
 */

/**
 * @param {{ first_name?: string, last_name?: string, firstName?: string, lastName?: string, email?: string } | null | undefined} profile
 * @param {string} [fallbackId]
 */
export function formatAdminUserLabel(profile, fallbackId = '') {
  const first = String(profile?.first_name || profile?.firstName || '').trim()
  const last = String(profile?.last_name || profile?.lastName || '').trim()
  const name = `${first} ${last}`.trim()
  const email = String(profile?.email || '').trim()
  if (name && email) return `${name} · ${email}`
  if (name) return name
  if (email) return email
  const id = String(fallbackId || profile?.id || '').trim()
  return id || '—'
}
