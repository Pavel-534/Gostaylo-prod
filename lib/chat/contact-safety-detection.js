/**
 * Shared contact-leak detector (server + client).
 * Detects likely attempts to move communication outside platform.
 */

const PHONE_REGEX = /(?:\+?\d[\d()\s.\-]{7,}\d)/g
const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const TELEGRAM_HANDLE_REGEX = /(^|\s)@[A-Za-z0-9_]{4,32}\b/g
const MESSENGER_LINK_REGEX =
  /\b(?:https?:\/\/)?(?:wa\.me|api\.whatsapp\.com|whatsapp\.com|t\.me|telegram\.me|line\.me|m\.me|vk\.me|wechat\.com|viber\.com)\/[^\s]*/gi
const MESSENGER_KEYWORD_REGEX =
  /\b(?:whatsapp|telegram|viber|wechat|line|скайп|ватсап|вотсап|телеграм|вайбер)\b/gi

function pushMatch(list, kind, value) {
  const val = String(value || '').trim()
  if (!val) return
  list.push({ kind, value: val })
}

export function detectContactSafety(text) {
  const src = String(text || '')
  if (!src.trim()) {
    return { hasSafetyTrigger: false, matchTypes: [], matches: [] }
  }

  const matches = []

  const phones = src.match(PHONE_REGEX) || []
  for (const p of phones) {
    const digits = p.replace(/\D/g, '')
    if (digits.length >= 8) pushMatch(matches, 'phone', p)
  }

  const emails = src.match(EMAIL_REGEX) || []
  for (const e of emails) pushMatch(matches, 'email', e)

  const handles = src.match(TELEGRAM_HANDLE_REGEX) || []
  for (const h of handles) pushMatch(matches, 'handle', h.trim())

  const links = src.match(MESSENGER_LINK_REGEX) || []
  for (const l of links) pushMatch(matches, 'messenger_link', l)

  const keywords = src.match(MESSENGER_KEYWORD_REGEX) || []
  for (const k of keywords) pushMatch(matches, 'messenger_keyword', k)

  const matchTypes = [...new Set(matches.map((m) => m.kind))]
  return {
    hasSafetyTrigger: matchTypes.length > 0,
    matchTypes,
    matches,
  }
}

