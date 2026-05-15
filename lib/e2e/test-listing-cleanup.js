/**
 * Detection + cleanup helpers for orphaned E2E / smoke listings (Stage 95.5).
 */

import { E2E_TEST_DATA_TAG, isMarkedE2eTestData } from './test-data-tag.js'
import { buildThumbStoragePath, parseStorageObjectRef } from '../storage/storage-path-utils.js'

/** PostgREST ilike patterns (title). */
export const TEST_LISTING_TITLE_LIKE_PATTERNS = [
  `%${E2E_TEST_DATA_TAG}%`,
  '%e2e%',
  '%test%',
  '%stage%',
  '%demo%',
  '%rls smoke%',
]

/** Id prefixes / substrings (checked in JS after fetch). */
export const TEST_LISTING_ID_PATTERNS = [
  /^lst-test/i,
  /demo/i,
  /^lst-villa-/i,
  /^lst-yacht-/i,
  /^lst-mm/i,
]

/**
 * @param {string | null | undefined} id
 */
export function isTestListingId(id) {
  const s = String(id || '').trim()
  if (!s) return false
  return TEST_LISTING_ID_PATTERNS.some((re) => re.test(s))
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 */
export function isTestListingRow(row) {
  if (!row || typeof row !== 'object') return false
  if (isMarkedE2eTestData(row)) return true
  if (isTestListingId(row.id)) return true
  const title = String(row.title || '').toLowerCase()
  if (title.includes('e2e') || title.includes('test') || title.includes('stage') || title.includes('demo')) {
    return true
  }
  return false
}

/**
 * Build PostgREST `.or()` filter for title ilike patterns.
 * @returns {string}
 */
export function buildTestListingTitleOrFilter() {
  const titleParts = TEST_LISTING_TITLE_LIKE_PATTERNS.map((p) => `title.ilike.${p.replace(/,/g, '')}`)
  const idParts = ['id.ilike.%test%', 'id.ilike.%demo%']
  return [...titleParts, ...idParts].join(',')
}

/**
 * @param {Record<string, unknown>} row
 * @returns {{ bucket: string, path: string }[]}
 */
export function collectStorageRefsFromListingRow(row) {
  const refs = []
  if (row?.cover_image) refs.push(row.cover_image)
  const images = Array.isArray(row?.images) ? row.images : []
  for (const item of images) refs.push(item)

  const parsed = refs.map(parseStorageObjectRef).filter(Boolean)

  const withThumbs = []
  for (const ref of parsed) {
    withThumbs.push(ref)
    if (ref.path && !ref.path.endsWith('/') && !ref.path.includes('thumb_')) {
      const thumbPath = buildThumbStoragePath(ref.path)
      if (thumbPath && thumbPath !== ref.path) {
        withThumbs.push({ bucket: ref.bucket, path: thumbPath })
      }
    }
  }
  return withThumbs
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {{ protectListingIds?: string[] }} [opts]
 */
export async function fetchTestListingCandidates(sb, opts = {}) {
  const protect = new Set((opts.protectListingIds || []).map(String))

  const { data, error } = await sb
    .from('listings')
    .select('id,title,description,status,owner_id,images,cover_image,metadata')
    .or(buildTestListingTitleOrFilter())

  if (error) {
    throw new Error(`listings query: ${error.message}`)
  }

  const merged = new Map()
  for (const row of data || []) {
    if (!row?.id || protect.has(String(row.id))) continue
    if (isTestListingRow(row)) merged.set(String(row.id), row)
  }

  return [...merged.values()]
}
