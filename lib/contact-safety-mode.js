/**
 * Режим контактной безопасности в чате (сервер).
 * ENV: CONTACT_SAFETY_MODE = ADVISORY | REDACT | BLOCK
 */

export const CONTACT_SAFETY_MODES = ['ADVISORY', 'REDACT', 'BLOCK']

/**
 * @returns {'ADVISORY' | 'REDACT' | 'BLOCK'}
 */
export function getContactSafetyMode() {
  const raw = String(process.env.CONTACT_SAFETY_MODE || 'ADVISORY')
    .trim()
    .toUpperCase()
  if (CONTACT_SAFETY_MODES.includes(raw)) return raw
  return 'ADVISORY'
}
