/**
 * Stage 177.2 — slice SQL page rows and build opaque next cursor.
 */

import { encodeDiscoveryCursor } from '@/lib/search/discovery-cursor-codec'

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

  const last = pageRows[pageRows.length - 1]
  const rawCreatedAt = last?.created_at ?? last?.createdAt
  const lastId = String(last?.id ?? '').trim()

  if (!rawCreatedAt || !lastId) {
    return { pageRows, nextCursor: null, hasMore: false }
  }

  const lastCreatedAt =
    typeof rawCreatedAt === 'string' ? rawCreatedAt : new Date(rawCreatedAt).toISOString()

  const nextCursor = encodeDiscoveryCursor({ lastCreatedAt, lastId })
  return { pageRows, nextCursor, hasMore: true }
}
