/**
 * Нормализация типов сообщений платформы (нижний регистр).
 */

const ALLOWED = new Set(['text', 'image', 'file', 'invoice', 'system', 'voice'])

export function normalizeMessageType(type) {
  const t = String(type || 'text')
    .trim()
    .toLowerCase()
  return ALLOWED.has(t) ? t : 'text'
}

export function legacyTypeForUi(type) {
  const t = normalizeMessageType(type)
  if (t === 'invoice') return 'INVOICE'
  if (t === 'system') return 'SYSTEM'
  if (t === 'image') return 'IMAGE'
  if (t === 'file') return 'FILE'
  if (t === 'voice') return 'VOICE'
  return 'TEXT'
}
