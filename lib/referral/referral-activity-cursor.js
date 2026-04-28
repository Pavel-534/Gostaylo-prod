/**
 * Cursor для пагинации ленты реферальной активности (offset в отсортированном списке).
 * Формат: base64url(JSON.stringify({ v: 1, o: number }))
 */

export function encodeReferralActivityCursor(offset) {
  const o = Math.max(0, Math.floor(Number(offset) || 0))
  try {
    return Buffer.from(JSON.stringify({ v: 1, o }), 'utf8').toString('base64url')
  } catch {
    return null
  }
}

export function decodeReferralActivityCursor(cursor) {
  if (!cursor || typeof cursor !== 'string') return 0
  try {
    const json = Buffer.from(cursor.trim(), 'base64url').toString('utf8')
    const j = JSON.parse(json)
    if (j?.v === 1 && Number.isFinite(j?.o)) return Math.max(0, Math.floor(j.o))
  } catch {
    /* ignore */
  }
  return 0
}
