/**
 * Нормализация типов сообщений платформы (нижний регистр).
 */

const ALLOWED = new Set(['text', 'image', 'invoice', 'system'])

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
  return 'TEXT'
}
