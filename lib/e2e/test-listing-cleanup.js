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
  '%test-%',
  '%stage%',
  '%stage72%',
  '%demo%',
  '%rls smoke%',
]

/** Stable id reused by stage72 fixture (Stage 96.2). */
export const STAGE72_REUSE_LISTING_ID = 'lst-e2e-stage72-cashflow'

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

/** Stage 96.2 — cleanup targets: E2E tag, stage72, test- prefix, legacy heuristics. */
export function isAggressiveE2eListingCandidate(row) {
  if (!row || typeof row !== 'object') return false
  const title = String(row.title || '')
  const desc = String(row.description || '')
  if (title.includes(E2E_TEST_DATA_TAG) || desc.includes(E2E_TEST_DATA_TAG)) return true
  if (/stage72/i.test(title) || /stage72/i.test(desc)) return true
  if (/test-/i.test(title)) return true
  return isTestListingRow(row)
}

/**
 * Build PostgREST `.or()` filter for title ilike patterns.
 * @returns {string}
 */
export function buildTestListingTitleOrFilter() {
  const titleParts = TEST_LISTING_TITLE_LIKE_PATTERNS.map((p) => `title.ilike.${p.replace(/,/g, '')}`)
  const idParts = ['id.ilike.%test%', 'id.ilike.%demo%', `id.eq.${STAGE72_REUSE_LISTING_ID}`]
  const descParts = ['description.ilike.%E2E_TEST_DATA%', 'description.ilike.%stage72%']
  return [...titleParts, ...idParts, ...descParts].join(',')
}

/**
 * List Storage objects under `{listingId}/` including thumb_* siblings.
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {string} listingId
 * @returns {Promise<{ bucket: string, path: string }[]>}
 */
export async function listListingStoragePathsWithThumbs(sb, listingId) {
  const buckets = ['listing-images', 'listings']
  const refs = []
  const prefix = String(listingId || '').trim()
  if (!prefix) return refs

  for (const bucket of buckets) {
    const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: 500 })
    if (error || !data?.length) continue
    for (const file of data) {
      if (!file?.name) continue
      const path = `${prefix}/${file.name}`
      refs.push({ bucket, path })
      if (!file.name.startsWith('thumb_')) {
        const thumbPath = buildThumbStoragePath(path)
        if (thumbPath && thumbPath !== path) refs.push({ bucket, path: thumbPath })
      }
    }
  }
  return refs
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
  const ingest = (rows) => {
    for (const row of rows || []) {
      if (!row?.id || protect.has(String(row.id))) continue
      if (isAggressiveE2eListingCandidate(row)) merged.set(String(row.id), row)
    }
  }
  ingest(data)

  /** Catch rows tagged only in metadata (PostgREST JSON filter). */
  const { data: metaTagged } = await sb
    .from('listings')
    .select('id,title,description,status,owner_id,images,cover_image,metadata')
    .contains('metadata', { test_data_tag: E2E_TEST_DATA_TAG })
  ingest(metaTagged)

  return [...merged.values()]
}
