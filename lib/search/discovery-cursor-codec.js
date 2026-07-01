/**
 * Stage 177.2 — opaque keyset cursor codec (catalog discovery SSOT).
 * Format: Base64URL(JSON.stringify([lastCreatedAtIso, listingId]))
 */

/** @typedef {'created_at'} DiscoveryStableSortKey */

/** @typedef {Object} DiscoveryDecodedCursor
 * @property {DiscoveryStableSortKey} sortKey
 * @property {string} lastCreatedAt
 * @property {string} lastId
 */

/** @typedef {Object} DiscoveryCursorDecodeIssue
 * @property {'CURSOR_INVALID'|'CURSOR_ID_INVALID'} code
 * @property {string} message
 */

export const DISCOVERY_STABLE_CATALOG_SORT = 'created_at'

/**
 * @param {string | null | undefined} sort
 * @returns {boolean}
 */
export function isDiscoveryStableCatalogSort(sort) {
  return String(sort || '').trim().toLowerCase() === DISCOVERY_STABLE_CATALOG_SORT
}

/**
 * @param {{ lastCreatedAt: string, lastId: string }} params
 * @returns {string}
 */
export function encodeDiscoveryCursor({ lastCreatedAt, lastId }) {
  const createdAt = String(lastCreatedAt || '').trim()
  const id = String(lastId || '').trim()
  if (!createdAt || !id) {
    throw new Error('encodeDiscoveryCursor requires lastCreatedAt and lastId')
  }
  const payload = JSON.stringify([createdAt, id])
  return Buffer.from(payload, 'utf8').toString('base64url')
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, value: DiscoveryDecodedCursor } | { ok: false, issue: DiscoveryCursorDecodeIssue }}
 */
export function decodeDiscoveryCursor(raw) {
  const trimmed = raw != null ? String(raw).trim() : ''
  if (!trimmed) {
    return { ok: false, issue: { code: 'CURSOR_INVALID', message: 'Cursor is empty' } }
  }

  let parsed
  try {
    const json = Buffer.from(trimmed, 'base64url').toString('utf8')
    parsed = JSON.parse(json)
  } catch {
    return { ok: false, issue: { code: 'CURSOR_INVALID', message: 'Cursor is not valid Base64URL JSON' } }
  }

  if (!Array.isArray(parsed) || parsed.length !== 2) {
    return {
      ok: false,
      issue: { code: 'CURSOR_INVALID', message: 'Cursor payload must be a JSON array of length 2' },
    }
  }

  const lastCreatedAt = parsed[0]
  const lastId = parsed[1]

  if (typeof lastCreatedAt !== 'string' || !lastCreatedAt.trim()) {
    return {
      ok: false,
      issue: { code: 'CURSOR_INVALID', message: 'Cursor sort value must be a non-empty string' },
    }
  }

  if (typeof lastId !== 'string' || !lastId.trim()) {
    return {
      ok: false,
      issue: { code: 'CURSOR_ID_INVALID', message: 'Cursor listing id must be a non-empty string' },
    }
  }

  return {
    ok: true,
    value: {
      sortKey: DISCOVERY_STABLE_CATALOG_SORT,
      lastCreatedAt: lastCreatedAt.trim(),
      lastId: lastId.trim(),
    },
  }
}
