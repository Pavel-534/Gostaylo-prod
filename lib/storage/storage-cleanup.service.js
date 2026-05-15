/**
 * Lightweight orphan cleanup for Supabase Storage (Stage 95.2).
 * Budget-aware: caps list/delete per run for Vercel Hobby / external cron.
 */

import { STORAGE_BUCKETS } from './storage-buckets.js'
import {
  addStorageRefFromValue,
  parseStorageObjectRef,
  storageRefKey,
} from './storage-path-utils.js'

export const CLEANUP_SCAN_BUCKETS = [
  STORAGE_BUCKETS.AVATARS,
  STORAGE_BUCKETS.LISTING_IMAGES,
  STORAGE_BUCKETS.LISTINGS_LEGACY,
  STORAGE_BUCKETS.REVIEW_IMAGES,
  STORAGE_BUCKETS.CHAT_ATTACHMENTS,
  STORAGE_BUCKETS.VERIFICATION_DOCUMENTS,
  STORAGE_BUCKETS.DISPUTE_EVIDENCE,
]

const DEFAULT_MIN_AGE_DAYS = 7
const DEFAULT_GRACE_HOURS = 48
const LIST_PAGE = 200
const DEFAULT_MAX_LIST_PER_BUCKET = 600
const DEFAULT_MAX_DELETE_PER_RUN = 120
const DEFAULT_MAX_MESSAGE_ROWS = 400
const DEFAULT_BUDGET_MS = 25_000

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {{ maxMessageRows?: number }} [opts]
 */
export async function collectReferencedStorageKeys(supabaseAdmin, opts = {}) {
  const keys = new Set()
  const maxMsg = Math.max(0, Number(opts.maxMessageRows) ?? DEFAULT_MAX_MESSAGE_ROWS)

  const addRows = (rows, pick) => {
    for (const row of rows || []) {
      for (const v of pick(row)) addStorageRefFromValue(v, keys)
    }
  }

  const { data: profiles } = await supabaseAdmin.from('profiles').select('avatar')
  addRows(profiles, (r) => [r.avatar])

  const { data: listings } = await supabaseAdmin.from('listings').select('id, images, cover_image')
  addRows(listings, (r) => [r.images, r.cover_image])

  const { data: reviews } = await supabaseAdmin.from('reviews').select('photos')
  addRows(reviews, (r) => [r.photos])

  const { data: apps } = await supabaseAdmin
    .from('partner_applications')
    .select('verification_doc_url')
  addRows(apps, (r) => [r.verification_doc_url])

  const { data: disputes } = await supabaseAdmin.from('disputes').select('metadata')
  addRows(disputes, (r) => {
    const m = r.metadata && typeof r.metadata === 'object' ? r.metadata : {}
    return [m.evidence_urls, m.evidenceUrls]
  })

  if (maxMsg > 0) {
    const { data: messages, error } = await supabaseAdmin
      .from('messages')
      .select('metadata, type')
      .or('type.eq.image,type.eq.file')
      .order('created_at', { ascending: false })
      .limit(maxMsg)
    if (error) {
      console.warn('[storage-cleanup] messages sample:', error.message)
    } else {
      for (const row of messages || []) {
        const m = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
        addStorageRefFromValue([m.image_url, m.url, m.file_url, m.attachment_url], keys)
      }
    }
  }

  const listingIds = new Set((listings || []).map((l) => String(l.id)))
  return { keys, listingIds }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {string} bucket
 * @param {string} [prefix]
 * @param {{ maxObjects: number, minAgeMs: number, onObject: (obj: { name: string, created_at?: string, updated_at?: string }) => boolean }} ctx
 */
async function listObjectsBounded(supabaseAdmin, bucket, prefix, ctx) {
  let offset = 0
  let listed = 0
  while (listed < ctx.maxObjects) {
    const limit = Math.min(LIST_PAGE, ctx.maxObjects - listed)
    const { data, error } = await supabaseAdmin.storage.from(bucket).list(prefix, {
      limit,
      offset,
      sortBy: { column: 'created_at', order: 'asc' },
    })
    if (error) throw new Error(`${bucket}/${prefix}: ${error.message}`)
    if (!data?.length) break

    for (const item of data) {
      if (listed >= ctx.maxObjects) return { listed, truncated: true }
      const name = item.name
      if (!name || name === '.emptyFolderPlaceholder') continue
      const fullPath = prefix ? `${prefix}/${name}` : name
      const isFolder = item.id == null && !String(name).includes('.')

      if (isFolder) {
        const sub = await listObjectsBounded(supabaseAdmin, bucket, fullPath, {
          ...ctx,
          maxObjects: ctx.maxObjects - listed,
        })
        listed += sub.listed
        if (sub.truncated) return { listed, truncated: true }
        continue
      }

      listed += 1
      const ageMs = objectAgeMs(item)
      if (ageMs < ctx.minAgeMs) continue
      ctx.onObject({ name: fullPath, created_at: item.created_at, updated_at: item.updated_at })
    }

    if (data.length < limit) break
    offset += limit
  }
  return { listed, truncated: false }
}

function objectAgeMs(obj) {
  const raw = obj.updated_at || obj.created_at
  if (!raw) return Infinity
  const t = new Date(raw).getTime()
  return Number.isFinite(t) ? Date.now() - t : Infinity
}

function overBudget(startedAt, budgetMs) {
  return Date.now() - startedAt >= budgetMs
}

/**
 * @param {{
 *   supabaseAdmin: import('@supabase/supabase-js').SupabaseClient,
 *   dryRun?: boolean,
 *   minAgeDays?: number,
 *   graceHours?: number,
 *   buckets?: string[],
 *   maxListPerBucket?: number,
 *   maxDeletesPerRun?: number,
 *   maxMessageRows?: number,
 *   budgetMs?: number,
 * }} opts
 */
export async function runStorageCleanup(opts) {
  const startedAt = Date.now()
  const supabaseAdmin = opts.supabaseAdmin
  const dryRun = opts.dryRun !== false
  const minAgeDays = Math.max(1, Number(opts.minAgeDays) || DEFAULT_MIN_AGE_DAYS)
  const graceHours = Math.max(0, Number(opts.graceHours) || DEFAULT_GRACE_HOURS)
  const minAgeMs = minAgeDays * 24 * 60 * 60 * 1000
  const graceMs = graceHours * 60 * 60 * 1000
  const buckets = opts.buckets?.length ? opts.buckets : CLEANUP_SCAN_BUCKETS
  const maxListPerBucket = Math.max(50, Number(opts.maxListPerBucket) || DEFAULT_MAX_LIST_PER_BUCKET)
  const maxDeletesPerRun = Math.max(0, Number(opts.maxDeletesPerRun) ?? DEFAULT_MAX_DELETE_PER_RUN)
  const budgetMs = Math.max(3000, Number(opts.budgetMs) || DEFAULT_BUDGET_MS)

  const { keys: referenced, listingIds } = await collectReferencedStorageKeys(supabaseAdmin, {
    maxMessageRows: opts.maxMessageRows,
  })

  if (overBudget(startedAt, budgetMs)) {
    return buildCleanupResult({
      startedAt,
      dryRun,
      minAgeDays,
      graceHours,
      referenced,
      buckets,
      abortedDueToTimeout: true,
    })
  }

  const candidates = []
  const skipped = { referenced: 0, tooYoung: 0, protectedPrefix: 0 }
  let objectsListed = 0
  let listTruncated = false

  for (const bucket of buckets) {
    if (overBudget(startedAt, budgetMs)) break

    try {
      const listRes = await listObjectsBounded(supabaseAdmin, bucket, '', {
        maxObjects: maxListPerBucket,
        minAgeMs,
        onObject: (obj) => {
          const path = obj.name
          const key = storageRefKey(bucket, path)
          const ageMs = objectAgeMs(obj)

          if (ageMs < graceMs) {
            skipped.tooYoung += 1
            return
          }
          if (referenced.has(key)) {
            skipped.referenced += 1
            return
          }

          const firstSeg = path.split('/')[0]
          if (
            (bucket === STORAGE_BUCKETS.LISTING_IMAGES ||
              bucket === STORAGE_BUCKETS.LISTINGS_LEGACY) &&
            listingIds.has(firstSeg) &&
            ageMs < minAgeMs
          ) {
            skipped.protectedPrefix += 1
            return
          }

          if (!parseStorageObjectRef(`/_storage/${bucket}/${path}`)) return

          candidates.push({ bucket, path, ageMs, reason: 'orphan_unreferenced' })
        },
      })
      objectsListed += listRes.listed
      if (listRes.truncated) listTruncated = true
    } catch (e) {
      console.warn('[storage-cleanup] list failed:', bucket, e?.message || e)
    }
  }

  let deleted = 0
  let deleteErrors = 0
  const byBucket = {}
  const toDelete = candidates.slice(0, maxDeletesPerRun)
  const deleteTruncated = candidates.length > toDelete.length

  if (!dryRun && toDelete.length > 0) {
    const byBucketPaths = new Map()
    for (const c of toDelete) {
      if (!byBucketPaths.has(c.bucket)) byBucketPaths.set(c.bucket, [])
      byBucketPaths.get(c.bucket).push(c.path)
    }
    for (const [bucket, paths] of byBucketPaths) {
      if (overBudget(startedAt, budgetMs)) break
      for (let i = 0; i < paths.length; i += 50) {
        const chunk = paths.slice(i, i + 50)
        const { error } = await supabaseAdmin.storage.from(bucket).remove(chunk)
        if (error) {
          deleteErrors += chunk.length
          console.warn(`[storage-cleanup] remove ${bucket}:`, error.message)
        } else {
          deleted += chunk.length
          byBucket[bucket] = (byBucket[bucket] || 0) + chunk.length
        }
      }
    }
  }

  return buildCleanupResult({
    startedAt,
    dryRun,
    minAgeDays,
    graceHours,
    referenced,
    buckets,
    candidates,
    toDelete,
    deleted,
    deleteErrors,
    skipped,
    byBucket,
    objectsListed,
    listTruncated,
    deleteTruncated,
    abortedDueToTimeout: overBudget(startedAt, budgetMs),
  })
}

function buildCleanupResult(p) {
  const durationMs = Date.now() - p.startedAt
  const metrics = {
    durationMs,
    referencedCount: p.referenced.size,
    objectsListed: p.objectsListed ?? 0,
    candidatesFound: p.candidates?.length ?? 0,
    scheduledForDelete: p.toDelete?.length ?? 0,
    deleted: p.deleted ?? 0,
    deleteErrors: p.deleteErrors ?? 0,
    skipped: p.skipped ?? {},
    listTruncated: !!p.listTruncated,
    deleteTruncated: !!p.deleteTruncated,
    abortedDueToTimeout: !!p.abortedDueToTimeout,
  }

  console.info('[storage-cleanup] metrics', JSON.stringify(metrics))

  return {
    dryRun: p.dryRun,
    minAgeDays: p.minAgeDays,
    graceHours: p.graceHours,
    referencedCount: p.referenced.size,
    scannedBuckets: p.buckets,
    candidateCount: p.candidates?.length ?? 0,
    deleted: p.deleted ?? 0,
    deleteErrors: p.deleteErrors ?? 0,
    skipped: p.skipped,
    byBucket: p.byBucket ?? {},
    sample: (p.toDelete || p.candidates || []).slice(0, 20).map((c) => `${c.bucket}/${c.path}`),
    metrics,
    abortedDueToTimeout: metrics.abortedDueToTimeout,
  }
}
