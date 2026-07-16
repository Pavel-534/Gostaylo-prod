/**
 * Stage 189.0+ — E.164 phone normalization SSOT.
 */

/** Normalize to E.164-ish digits with leading + */
export function normalizePhoneE164(raw) {
  const digits = String(raw || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 11 && digits.startsWith('8')) return `+7${digits.slice(1)}`
  if (digits.length === 10) return `+7${digits}`
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`
  return ''
}
