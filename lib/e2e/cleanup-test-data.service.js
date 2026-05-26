/**
 * Remove accumulated test listings (+ bookings, storage). Dry-run by default.
 */

import {
  collectStorageRefsFromListingRow,
  fetchTestListingCandidates,
  listListingStoragePathsWithThumbs,
} from './test-listing-cleanup.js'
import { runAggressiveTestUserCleanup } from './cleanup-test-users.service.js'
import { runCleanupTestMarketingReferral } from './cleanup-test-marketing-referral.service.js'
import { cleanupChatStressGarbageMessages } from './chat-stress-message-markers.js'

const CHUNK = 150

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
  const maxStorageDeletes = Number(opts.maxStorageDeletes) || 2500

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
      storageRefs.push(...(await listListingStoragePathsWithThumbs(sb, String(row.id))))
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
    chatStressGarbageCount: 0,
    deleted: {
      messages: 0,
      chatStressMessages: 0,
      conversations: 0,
      payments: 0,
      invoices: 0,
      bookings: 0,
      listings: 0,
      listingsSoftPurged: 0,
      storageObjects: 0,
      testUsers: 0,
      authUsers: 0,
      referral_ledger: 0,
      marketing_promo_tank_ledger: 0,
      wallet_transactions: 0,
    },
    testUserCount: 0,
    marketingReferralCount: 0,
  }

  const marketingPreview = await runCleanupTestMarketingReferral(sb, { dryRun: true })
  report.marketingReferralCount = marketingPreview.marketingReferralCount

  const chatStressPreview = await cleanupChatStressGarbageMessages(sb, { dryRun: true })
  report.chatStressGarbageCount = chatStressPreview.count

  const userPreview = await runAggressiveTestUserCleanup(sb, { dryRun: true })
  report.testUserCount = userPreview.profileCount
  report.testUserCandidates = userPreview.candidates

  if (dryRun) {
    report.deleted.testUsers = 0
    return report
  }

  const chatStressReport = await cleanupChatStressGarbageMessages(sb, { dryRun: false })
  report.chatStressGarbageCount = chatStressReport.count
  report.deleted.chatStressMessages = chatStressReport.count

  const marketingReport = await runCleanupTestMarketingReferral(sb, { dryRun: false })
  report.marketingReferralCount = marketingReport.marketingReferralCount
  report.deleted.referral_ledger = marketingReport.deleted.referral_ledger
  report.deleted.marketing_promo_tank_ledger = marketingReport.deleted.marketing_promo_tank_ledger
  report.deleted.wallet_transactions = marketingReport.deleted.wallet_transactions

  const userReport = await runAggressiveTestUserCleanup(sb, { dryRun: false })
  report.testUserCount = userReport.profileCount
  report.testUserCandidates = userReport.candidates
  report.deleted.testUsers = userReport.deleted.profiles
  report.deleted.authUsers = userReport.deleted.auth_users
  report.deleted.messages += userReport.deleted.messages
  report.deleted.conversations += userReport.deleted.conversations
  report.deleted.payments += userReport.deleted.payments
  report.deleted.invoices += userReport.deleted.invoices
  report.deleted.bookings += userReport.deleted.bookings
  report.deleted.listings += userReport.deleted.listings
  report.deleted.storageObjects += userReport.deleted.storageObjects
  report.deleted.referral_ledger += userReport.deleted.referral_ledger ?? 0
  report.deleted.marketing_promo_tank_ledger += userReport.deleted.marketing_promo_tank_ledger ?? 0
  report.deleted.wallet_transactions += userReport.deleted.wallet_transactions ?? 0

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

  for (const part of chunks(conversationIds)) {
    if (!part.length) continue
    const { count, error } = await sb.from('messages').delete({ count: 'exact' }).in('conversation_id', part)
    if (!error && typeof count === 'number') report.deleted.messages += count
  }

  await safeDeleteIn(sb, 'telegram_chat_reply_map', 'conversation_id', conversationIds)
  report.deleted.payments += await safeDeleteIn(sb, 'payments', 'booking_id', bookingIds)
  report.deleted.invoices += await safeDeleteIn(sb, 'invoices', 'booking_id', bookingIds)
  report.deleted.conversations += await safeDeleteIn(sb, 'conversations', 'id', conversationIds)
  await safeDeleteIn(sb, 'payout_batch_items', 'booking_id', bookingIds)
  report.deleted.bookings += await safeDeleteIn(sb, 'bookings', 'id', bookingIds)
  report.deleted.listings += await safeDeleteIn(sb, 'listings', 'id', listingIds)

  if (report.deleted.listings < listingIds.length && listingIds.length > 0) {
    const { data: stillThere } = await sb.from('listings').select('id').in('id', listingIds)
    const remaining = (stillThere || []).map((r) => String(r.id)).filter(Boolean)
    if (remaining.length > 0) {
      report.deleted.listingsSoftPurged = await softPurgeTestListings(sb, remaining)
    }
  }

  return report
}

/**
 * Fallback when DELETE fails (legacy storage trigger). Removes rows from catalog without touching storage.objects SQL.
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {string[]} listingIds
 */
async function softPurgeTestListings(sb, listingIds) {
  let purged = 0
  for (const part of chunks(listingIds)) {
    if (!part.length) continue
    const { data: rows } = await sb.from('listings').select('id, metadata').in('id', part)
    for (const row of rows || []) {
      const meta =
        row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
          ? { ...row.metadata }
          : {}
      meta.is_deleted = true
      meta.e2e_purged_at = new Date().toISOString()
      const { error } = await sb
        .from('listings')
        .update({ status: 'INACTIVE', available: false, metadata: meta })
        .eq('id', row.id)
      if (!error) purged += 1
    }
  }
  if (purged > 0) {
    console.warn(
      `[cleanup-test-data] soft-purged ${purged} listing(s) (INACTIVE); apply migration 052 for hard DELETE`,
    )
  }
  return purged
}
