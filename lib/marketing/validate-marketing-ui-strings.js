/**
 * Stage 41.0 — validate admin payload for `system_settings.marketing_ui_strings`.
 * Ensures placeholder tokens exist so ListingFlashHotStrip does not break.
 */

import { MARKETING_UI_LANGS, MARKETING_UI_STRING_KEYS } from '@/lib/constants/marketing'

const PLACEHOLDERS = {
  flashHotBookingsToday: '{{count}}',
  flashHotExpiresIn: '{{hm}}',
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, value: Record<string, Record<string, string>> } | { ok: false, errors: string[] }}
 */
export function validateMarketingUiStringsPayload(raw) {
  const errors = []
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['Root value must be a JSON object (language keys → string fields).'] }
  }

  /** @type {Record<string, Record<string, string>>} */
  const out = {}

  for (const lang of Object.keys(raw)) {
    if (!MARKETING_UI_LANGS.includes(String(lang).toLowerCase())) {
      errors.push(`Unknown language key "${lang}". Allowed: ${MARKETING_UI_LANGS.join(', ')}.`)
      continue
    }
    const safeLang = String(lang).toLowerCase()
    const patch = raw[lang]
    if (patch == null) continue
    if (typeof patch !== 'object' || Array.isArray(patch)) {
      errors.push(`"${safeLang}" must be an object with string fields.`)
      continue
    }
    const langOut = {}
    for (const k of MARKETING_UI_STRING_KEYS) {
      const v = patch[k]
      if (v === undefined || v === null || v === '') continue
      if (typeof v !== 'string') {
        errors.push(`"${safeLang}.${k}" must be a string.`)
        continue
      }
      const trimmed = v.trim()
      if (!trimmed) continue
      const token = PLACEHOLDERS[k]
      if (token && !trimmed.includes(token)) {
        errors.push(`"${safeLang}.${k}" must contain the placeholder ${token}.`)
        continue
      }
      langOut[k] = trimmed
    }
    if (Object.keys(langOut).length) out[safeLang] = langOut
  }

  if (errors.length) return { ok: false, errors }
  return { ok: true, value: out }
}
