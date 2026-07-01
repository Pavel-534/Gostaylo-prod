/**
 * Stage 177.2 — slice SQL page rows and build opaque next cursor.
 */

import { encodeDiscoveryCursor } from '@/lib/search/discovery-cursor-codec'

/**
 * @param {object|null|undefined} row
 * @returns {string|null}
 */
export function buildDiscoveryCursorFromListingRow(row) {
  const rawCreatedAt = row?.created_at ?? row?.createdAt
  const lastId = String(row?.id ?? '').trim()

  if (!rawCreatedAt || !lastId) {
    return null
  }

  const lastCreatedAt =
    typeof rawCreatedAt === 'string' ? rawCreatedAt : new Date(rawCreatedAt).toISOString()

  return encodeDiscoveryCursor({ lastCreatedAt, lastId })
}

/**
 * @param {object[]|null|undefined} rows
 * @param {number} pageSize
 * @returns {{ pageRows: object[], nextCursor: string|null, hasMore: boolean }}
 */
export function slicePageAndBuildNextCursor(rows, pageSize) {
  const list = Array.isArray(rows) ? rows : []
  const size = Math.max(1, Math.floor(Number(pageSize) || 24))
  const hasMore = list.length > size
  const pageRows = hasMore ? list.slice(0, size) : list

  if (!hasMore || pageRows.length === 0) {
    return { pageRows, nextCursor: null, hasMore: false }
  }

  const nextCursor = buildDiscoveryCursorFromListingRow(pageRows[pageRows.length - 1])
  return { pageRows, nextCursor, hasMore: true }
}
