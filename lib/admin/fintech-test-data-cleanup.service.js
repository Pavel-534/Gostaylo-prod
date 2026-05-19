/**
 * Stage 106.4 — удаление smoke / E2E / financial-test данных из FinTech.
 */

import { E2E_TEST_DATA_TAG } from '@/lib/e2e/test-data-tag'
import { runCleanupTestData } from '@/lib/e2e/cleanup-test-data.service.js'
import {
  isFintechTestBookingRow,
  isFintechTestPayoutBatchRow,
  isFintechTestPayoutRow,
  isFintechTestProfileRow,
} from '@/lib/admin/fintech-test-data-markers.js'

const CHUNK = 150
const LIKE = `%${E2E_TEST_DATA_TAG}%`

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
      console.warn(`[fintech-test-cleanup] ${label || table}:`, error.message)
    } else if (typeof count === 'number') {
      deleted += count
    }
  }
  return deleted
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 */
async function collectTestBookingIds(sb) {
  const ids = new Set()

  const ingestRows = (rows) => {
    for (const row of rows || []) {
      if (isFintechTestBookingRow(row)) ids.add(String(row.id))
    }
  }

  const { data: byTagSr } = await sb.from('bookings').select('id, listing_id, guest_name, special_requests, renter_id, partner_id').ilike('special_requests', LIKE)
  const { data: byTagGn } = await sb.from('bookings').select('id, listing_id, guest_name, special_requests, renter_id, partner_id').ilike('guest_name', LIKE)
  ingestRows(byTagSr)
  ingestRows(byTagGn)

  const { data: byListing } = await sb
    .from('bookings')
    .select('id, listing_id, guest_name, special_requests, renter_id, partner_id')
    .or('listing_id.ilike.lst-stage%,listing_id.ilike.lst-test%,listing_id.eq.lst-stage104-smoke,listing_id.eq.lst-stage103-smoke')
  ingestRows(byListing)

  const profileIds = await collectSmokeProfileIds(sb)
  for (const pid of profileIds) {
    const { data } = await sb
      .from('bookings')
      .select('id, listing_id, guest_name, special_requests, renter_id, partner_id')
      .or(`renter_id.eq.${pid},partner_id.eq.${pid}`)
    ingestRows(data)
  }

  return [...ids]
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 */
async function collectSmokeProfileIds(sb) {
  const ids = new Set()
  const { data: byId } = await sb.from('profiles').select('id, email, first_name, full_name').ilike('id', 'user-smoke-%')
  const { data: byEmail } = await sb.from('profiles').select('id, email, first_name, full_name').ilike('email', '%@smoke.invalid')
  for (const row of [...(byId || []), ...(byEmail || [])]) {
    if (isFintechTestProfileRow(row)) ids.add(String(row.id))
  }
  return [...ids]
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {string[]} bookingIds
 */
async function collectTestBatchIds(sb, bookingIds) {
  const batchIds = new Set()

  const { data: byPattern } = await sb.from('payout_batches').select('id').ilike('id', 'pb-stage%')
  for (const row of byPattern || []) if (row?.id) batchIds.add(String(row.id))

  for (const part of chunks(bookingIds)) {
    if (!part.length) continue
    const { data } = await sb.from('payout_batch_items').select('batch_id').in('booking_id', part)
    for (const row of data || []) if (row?.batch_id) batchIds.add(String(row.batch_id))
  }

  return [...batchIds]
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {string[]} profileIds
 */
async function collectTestPayoutIds(sb, profileIds) {
  const ids = new Set()
  const { data: byNotes } = await sb.from('payouts').select('id, notes, partner_id').ilike('notes', LIKE)
  for (const row of byNotes || []) {
    if (isFintechTestPayoutRow(row)) ids.add(String(row.id))
  }
  for (const pid of profileIds) {
    const { data } = await sb.from('payouts').select('id, notes, partner_id').eq('partner_id', pid)
    for (const row of data || []) ids.add(String(row.id))
  }
  return [...ids]
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {string[]} bookingIds
 */
async function collectLedgerJournalIds(sb, bookingIds) {
  const journalIds = new Set()
  for (const part of chunks(bookingIds)) {
    if (!part.length) continue
    const { data } = await sb.from('ledger_journals').select('id, booking_id, idempotency_key, metadata').in('booking_id', part)
    for (const row of data || []) {
      if (row?.id) journalIds.add(String(row.id))
    }
  }
  return [...journalIds]
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {string[]} bookingIds
 */
async function fetchConversationIds(sb, bookingIds) {
  const out = []
  for (const part of chunks(bookingIds)) {
    const { data, error } = await sb.from('conversations').select('id').in('booking_id', part)
    if (error) {
      console.warn('[fintech-test-cleanup] conversations:', error.message)
      continue
    }
    for (const row of data || []) if (row?.id) out.push(String(row.id))
  }
  return uniq(out)
}

/**
 * Убрать пулы, полностью состоящие из smoke/E2E броней (или с id pb-stage*).
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {object[]} batches
 */
export async function filterPayoutBatchesExcludeTest(sb, batches) {
  if (!batches?.length) return []

  const batchIds = batches.map((b) => String(b.id))
  const itemsByBatch = new Map()
  const bookingIds = new Set()

  for (const part of chunks(batchIds)) {
    const { data } = await sb
      .from('payout_batch_items')
      .select('batch_id, booking_id')
      .in('batch_id', part)
    for (const row of data || []) {
      if (!row?.batch_id) continue
      const bid = String(row.batch_id)
      if (!itemsByBatch.has(bid)) itemsByBatch.set(bid, [])
      if (row.booking_id) {
        itemsByBatch.get(bid).push(String(row.booking_id))
        bookingIds.add(String(row.booking_id))
      }
    }
  }

  const testBookings = new Set()
  for (const part of chunks([...bookingIds])) {
    const { data } = await sb
      .from('bookings')
      .select('id, listing_id, guest_name, special_requests, renter_id, partner_id')
      .in('id', part)
    for (const b of data || []) {
      if (isFintechTestBookingRow(b)) testBookings.add(String(b.id))
    }
  }

  return batches.filter((batch) => {
    const items = itemsByBatch.get(String(batch.id)) || []
    const allItemsTest = items.length > 0 && items.every((bid) => testBookings.has(bid))
    return !isFintechTestPayoutBatchRow(batch, { allItemsTest })
  })
}

export function sumFintechCleanupDeleted(deleted) {
  if (!deleted || typeof deleted !== 'object') return 0
  return Object.values(deleted).reduce((sum, n) => sum + (Number(n) || 0), 0)
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {{ dryRun?: boolean, protectListingIds?: string[] }} [opts]
 */
export async function runFintechTestDataCleanup(sb, opts = {}) {
  const dryRun = opts.dryRun !== false

  const bookingIds = await collectTestBookingIds(sb)
  const profileIds = await collectSmokeProfileIds(sb)
  const batchIds = await collectTestBatchIds(sb, bookingIds)
  const payoutIds = await collectTestPayoutIds(sb, profileIds)
  const journalIds = await collectLedgerJournalIds(sb, bookingIds)
  const conversationIds = bookingIds.length ? await fetchConversationIds(sb, bookingIds) : []

  const listingCleanupPreview = await runCleanupTestData(sb, {
    dryRun: true,
    protectListingIds: opts.protectListingIds,
  })

  const report = {
    dryRun,
    bookingIds: bookingIds.length,
    batchIds: batchIds.length,
    profileIds: profileIds.length,
    payoutIds: payoutIds.length,
    journalIds: journalIds.length,
    conversationIds: conversationIds.length,
    listingCandidates: listingCleanupPreview.listingCount,
    deleted: {
      ledger_entries: 0,
      ledger_journals: 0,
      payout_batch_items: 0,
      payout_batches: 0,
      messages: 0,
      conversations: 0,
      payments: 0,
      invoices: 0,
      payouts: 0,
      bookings: 0,
      listings: 0,
      profiles: 0,
    },
  }

  if (dryRun) {
    report.totalWouldDelete =
      bookingIds.length +
      batchIds.length +
      profileIds.length +
      payoutIds.length +
      journalIds.length +
      listingCleanupPreview.listingCount
    return report
  }

  report.deleted.ledger_entries = await safeDeleteIn(sb, 'ledger_entries', 'journal_id', journalIds)
  report.deleted.ledger_journals = await safeDeleteIn(sb, 'ledger_journals', 'id', journalIds)

  const batchItemIds = []
  for (const part of chunks(batchIds)) {
    const { data } = await sb.from('payout_batch_items').select('id').in('batch_id', part)
    for (const row of data || []) if (row?.id) batchItemIds.push(String(row.id))
  }
  report.deleted.payout_batch_items += await safeDeleteIn(sb, 'payout_batch_items', 'booking_id', bookingIds)
  report.deleted.payout_batch_items += await safeDeleteIn(sb, 'payout_batch_items', 'batch_id', batchIds)
  report.deleted.payout_batches = await safeDeleteIn(sb, 'payout_batches', 'id', batchIds)

  for (const part of chunks(conversationIds)) {
    if (!part.length) continue
    const { count, error } = await sb.from('messages').delete({ count: 'exact' }).in('conversation_id', part)
    if (!error && typeof count === 'number') report.deleted.messages += count
  }

  await safeDeleteIn(sb, 'telegram_chat_reply_map', 'conversation_id', conversationIds)
  report.deleted.payments = await safeDeleteIn(sb, 'payments', 'booking_id', bookingIds)
  report.deleted.invoices = await safeDeleteIn(sb, 'invoices', 'booking_id', bookingIds)
  report.deleted.conversations = await safeDeleteIn(sb, 'conversations', 'id', conversationIds)
  report.deleted.payouts = await safeDeleteIn(sb, 'payouts', 'id', payoutIds)
  report.deleted.bookings = await safeDeleteIn(sb, 'bookings', 'id', bookingIds)

  const listingReport = await runCleanupTestData(sb, {
    dryRun: false,
    protectListingIds: opts.protectListingIds,
  })
  report.deleted.listings = listingReport.deleted?.listings || 0
  report.deleted.listings += listingReport.deleted?.listingsSoftPurged || 0

  report.deleted.profiles = await safeDeleteIn(sb, 'profiles', 'id', profileIds)

  report.totalDeleted = sumFintechCleanupDeleted(report.deleted)
  return report
}
