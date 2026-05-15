/**
 * Remove accumulated test listings (+ bookings, storage). Dry-run by default.
 */

import {
  collectStorageRefsFromListingRow,
  fetchTestListingCandidates,
} from './test-listing-cleanup.js'

const CHUNK = 150
const LISTING_STORAGE_BUCKETS = ['listing-images', 'listings', 'avatars']

async function listStoragePathsForListingPrefix(sb, listingId) {
  const refs = []
  for (const bucket of LISTING_STORAGE_BUCKETS) {
    const { data, error } = await sb.storage.from(bucket).list(listingId, { limit: 200 })
    if (error || !data?.length) continue
    for (const file of data) {
      if (file?.name) refs.push({ bucket, path: `${listingId}/${file.name}` })
    }
  }
  return refs
}

function uniq(arr) {
  return [...new Set((arr || []).filter(Boolean).map((x) => String(x)))]
}

function chunks(arr, size = CHUNK) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function safeDeleteIn(sb, table, column, ids, label) {
  let deleted = 0
  for (const part of chunks(ids)) {
    if (!part.length) continue
    const { count, error } = await sb.from(table).delete({ count: 'exact' }).in(column, part)
    if (error && !String(error.message || '').includes('does not exist')) {
      console.warn(`[cleanup-test-data] ${label || table}:`, error.message)
    } else if (typeof count === 'number') {
      deleted += count
    }
  }
  return deleted
}

async function fetchBookingIdsForListings(sb, listingIds) {
  const bookingIds = new Set()
  for (const part of chunks(listingIds)) {
    const { data, error } = await sb.from('bookings').select('id').in('listing_id', part)
    if (error) {
      console.warn('[cleanup-test-data] bookings by listing:', error.message)
      continue
    }
    for (const row of data || []) if (row?.id) bookingIds.add(String(row.id))
  }
  return [...bookingIds]
}

async function fetchConversationIds(sb, bookingIds) {
  const out = []
  for (const part of chunks(bookingIds)) {
    const { data, error } = await sb.from('conversations').select('id').in('booking_id', part)
    if (error) {
      console.warn('[cleanup-test-data] conversations:', error.message)
      continue
    }
    for (const row of data || []) if (row?.id) out.push(String(row.id))
  }
  return uniq(out)
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {{ dryRun?: boolean, protectListingIds?: string[], maxStorageDeletes?: number }} [opts]
 */
export async function runCleanupTestData(sb, opts = {}) {
  const dryRun = opts.dryRun !== false
  const maxStorageDeletes = Number(opts.maxStorageDeletes) || 500

  const candidates = await fetchTestListingCandidates(sb, {
    protectListingIds: opts.protectListingIds,
  })

  const listingIds = candidates.map((r) => String(r.id))
  const bookingIds = listingIds.length ? await fetchBookingIdsForListings(sb, listingIds) : []
  const conversationIds = bookingIds.length ? await fetchConversationIds(sb, bookingIds) : []

  const storageRefs = []
  for (const row of candidates) {
    storageRefs.push(...collectStorageRefsFromListingRow(row))
    if (!dryRun && row?.id) {
      storageRefs.push(...(await listStoragePathsForListingPrefix(sb, String(row.id))))
    }
  }

  const bucketToPaths = new Map()
  for (const ref of storageRefs) {
    if (!ref?.bucket || !ref?.path) continue
    const arr = bucketToPaths.get(ref.bucket) || []
    arr.push(ref.path)
    bucketToPaths.set(ref.bucket, arr)
  }

  const report = {
    dryRun,
    candidates: candidates.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      owner_id: r.owner_id,
    })),
    listingCount: listingIds.length,
    bookingCount: bookingIds.length,
    conversationCount: conversationIds.length,
    storagePathsPlanned: [...bucketToPaths.entries()].reduce((n, [, p]) => n + uniq(p).length, 0),
    deleted: {
      messages: 0,
      conversations: 0,
      payments: 0,
      invoices: 0,
      bookings: 0,
      listings: 0,
      storageObjects: 0,
    },
  }

  if (dryRun) {
    return report
  }

  for (const part of chunks(conversationIds)) {
    if (!part.length) continue
    const { count, error } = await sb.from('messages').delete({ count: 'exact' }).in('conversation_id', part)
    if (!error && typeof count === 'number') report.deleted.messages += count
  }

  await safeDeleteIn(sb, 'telegram_chat_reply_map', 'conversation_id', conversationIds)
  report.deleted.payments = await safeDeleteIn(sb, 'payments', 'booking_id', bookingIds)
  report.deleted.invoices = await safeDeleteIn(sb, 'invoices', 'booking_id', bookingIds)
  report.deleted.conversations = await safeDeleteIn(sb, 'conversations', 'id', conversationIds)
  report.deleted.bookings = await safeDeleteIn(sb, 'bookings', 'id', bookingIds)
  report.deleted.listings = await safeDeleteIn(sb, 'listings', 'id', listingIds)

  let storageBudget = maxStorageDeletes
  for (const [bucket, paths] of bucketToPaths.entries()) {
    const uniquePaths = uniq(paths).filter((p) => !p.endsWith('/') || p.length > 2)
    for (const part of chunks(uniquePaths)) {
      if (!part.length || storageBudget <= 0) continue
      const batch = part.slice(0, storageBudget)
      const { error } = await sb.storage.from(bucket).remove(batch)
      if (error) {
        console.warn(`[cleanup-test-data] storage ${bucket}:`, error.message)
      } else {
        report.deleted.storageObjects += batch.length
        storageBudget -= batch.length
      }
    }
  }

  return report
}
