/**
 * Stage 106.4–106.5 — агрессивное удаление smoke / E2E / financial-test данных из FinTech.
 */

import { E2E_TEST_DATA_TAG } from '@/lib/e2e/test-data-tag'
import { runCleanupTestData } from '@/lib/e2e/cleanup-test-data.service.js'
import {
  isFintechTestBookingRow,
  isFintechTestConversionRow,
  isFintechTestCriticalSignalRow,
  isFintechTestLedgerEntryRow,
  isFintechTestLedgerJournalRow,
  isFintechTestPayoutBatchRow,
  isFintechTestPayoutRow,
  isFintechTestProfileRow,
  isFintechTestTreasuryAlert,
  matchesAggressiveTestHaystack,
} from '@/lib/admin/fintech-test-data-markers.js'
import { pruneTreasuryOpsAlerts } from '@/lib/treasury/treasury-ops-config.js'

const CHUNK = 150
const LIKE = `%${E2E_TEST_DATA_TAG}%`
const LEDGER_SCAN_LIMIT = 15_000
const BATCH_SCAN_LIMIT = 1_200

const BOOKING_ILIKE_PATTERNS = [
  LIKE,
  '%smoke%',
  '%stage%',
  '%E2E%',
  '%e2e_test%',
  '%financial-smoke%',
  '%@smoke.invalid%',
]

const LEDGER_JOURNAL_ID_PATTERNS = [
  'lj-payout-settled%',
  'lj-batch-settled%',
  '%smoke%',
  '%stage104%',
  '%stage103%',
  '%financial-smoke%',
]

const LEDGER_TEXT_PATTERNS = [
  `%${E2E_TEST_DATA_TAG}%`,
  '%smoke%',
  '%stage104%',
  '%stage103%',
  '%financial-smoke%',
  '%user-smoke%',
  '%@smoke.invalid%',
  '%lj-payout-settled%',
  '%lj-batch-settled%',
]

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
 * @param {string[]} journalIds
 */
async function countLedgerEntriesForJournals(sb, journalIds) {
  let total = 0
  for (const part of chunks(journalIds)) {
    if (!part.length) continue
    const { count, error } = await sb
      .from('ledger_entries')
      .select('*', { count: 'exact', head: true })
      .in('journal_id', part)
    if (!error && typeof count === 'number') total += count
  }
  return total
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

  const selectCols =
    'id, listing_id, guest_name, guest_email, special_requests, renter_id, partner_id, metadata'

  for (const pattern of BOOKING_ILIKE_PATTERNS) {
    for (const col of ['special_requests', 'guest_name', 'guest_email']) {
      const { data } = await sb.from('bookings').select(selectCols).ilike(col, pattern)
      ingestRows(data)
    }
  }

  const { data: byListing } = await sb
    .from('bookings')
    .select(selectCols)
    .or(
      'listing_id.ilike.lst-stage%,listing_id.ilike.lst-test%,listing_id.eq.lst-stage104-smoke,listing_id.eq.lst-stage103-smoke',
    )
  ingestRows(byListing)

  const { data: metaTagged } = await sb
    .from('bookings')
    .select(selectCols)
    .contains('metadata', { is_test_data: true })
  ingestRows(metaTagged)

  const profileIds = await collectSmokeProfileIds(sb)
  for (const pid of profileIds) {
    const { data } = await sb
      .from('bookings')
      .select(selectCols)
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
  const { data: byEmail } = await sb
    .from('profiles')
    .select('id, email, first_name, full_name')
    .ilike('email', '%@smoke.invalid')
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

  const { data: byPattern } = await sb.from('payout_batches').select('id, metadata, created_by, item_count').ilike('id', 'pb-stage%')
  for (const row of byPattern || []) {
    if (isFintechTestPayoutBatchRow(row)) batchIds.add(String(row.id))
  }

  const { data: byPbSmoke } = await sb
    .from('payout_batches')
    .select('id, metadata, created_by, item_count')
    .or('id.ilike.%smoke%,id.ilike.%stage%')
  for (const row of byPbSmoke || []) {
    if (isFintechTestPayoutBatchRow(row)) batchIds.add(String(row.id))
  }

  const { data: metaBatches } = await sb
    .from('payout_batches')
    .select('id, metadata, created_by, item_count')
    .contains('metadata', { is_test_data: true })
  for (const row of metaBatches || []) if (row?.id) batchIds.add(String(row.id))

  for (const part of chunks(bookingIds)) {
    if (!part.length) continue
    const { data } = await sb.from('payout_batch_items').select('batch_id').in('booking_id', part)
    for (const row of data || []) if (row?.batch_id) batchIds.add(String(row.batch_id))
  }

  return [...batchIds]
}

/**
 * Пулы только из тестовых броней, пустые smoke-пулы, пулы smoke-профиля.
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {string[]} bookingIds
 * @param {string[]} profileIds
 * @param {string[]} batchIds
 */
async function enrichTestBatchIds(sb, bookingIds, profileIds, batchIds) {
  const bookingSet = new Set(bookingIds)
  const profileSet = new Set(profileIds)
  const batchSet = new Set(batchIds)

  const { data: batches } = await sb
    .from('payout_batches')
    .select('id, metadata, created_by, item_count, status')
    .order('created_at', { ascending: false })
    .limit(BATCH_SCAN_LIMIT)

  for (const batch of batches || []) {
    const id = String(batch.id)
    if (batchSet.has(id)) continue
    if (isFintechTestPayoutBatchRow(batch)) {
      batchSet.add(id)
      continue
    }
    if (batch.created_by && profileSet.has(String(batch.created_by))) {
      batchSet.add(id)
      continue
    }

    const { data: items } = await sb.from('payout_batch_items').select('booking_id').eq('batch_id', id)
    if (!items?.length) {
      const ic = Number(batch.item_count) || 0
      if (
        ic === 0 &&
        (matchesAggressiveTestHaystack(JSON.stringify(batch.metadata || {})) ||
          (batch.created_by && profileSet.has(String(batch.created_by))))
      ) {
        batchSet.add(id)
      }
      continue
    }
    const allTest = items.every((i) => i.booking_id && bookingSet.has(String(i.booking_id)))
    if (allTest) batchSet.add(id)
  }

  return [...batchSet]
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
 * @param {Set<string>} journalIds
 * @param {Set<string>} bookingSet
 */
async function collectAggressiveLedgerPatterns(sb, journalIds, bookingSet) {
  for (const pattern of LEDGER_JOURNAL_ID_PATTERNS) {
    const { data } = await sb
      .from('ledger_journals')
      .select('id, booking_id, idempotency_key, metadata, event_type')
      .ilike('id', pattern)
      .limit(3000)
    for (const row of data || []) {
      if (!row?.id) continue
      if (isFintechTestLedgerJournalRow(row)) journalIds.add(String(row.id))
      else if (row.booking_id && bookingSet.has(String(row.booking_id))) journalIds.add(String(row.id))
    }
  }

  for (const pattern of LEDGER_TEXT_PATTERNS) {
    const { data: byKey } = await sb
      .from('ledger_journals')
      .select('id, booking_id, idempotency_key, metadata')
      .ilike('idempotency_key', pattern)
      .limit(2000)
    for (const row of byKey || []) if (row?.id) journalIds.add(String(row.id))
  }

  const { data: convEntries } = await sb
    .from('ledger_entries')
    .select('journal_id, description, metadata, conversion_from_currency')
    .not('conversion_from_currency', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5000)

  for (const row of convEntries || []) {
    if (!row?.journal_id) continue
    if (isFintechTestConversionRow(row)) journalIds.add(String(row.journal_id))
  }

  for (const pattern of LEDGER_TEXT_PATTERNS) {
    const { data: byDesc } = await sb
      .from('ledger_entries')
      .select('journal_id, description, metadata')
      .ilike('description', pattern)
      .limit(3000)
    for (const row of byDesc || []) {
      if (!row?.journal_id) continue
      if (isFintechTestLedgerEntryRow(row)) journalIds.add(String(row.journal_id))
      const bid = row.metadata?.booking_id
      if (bid && bookingSet.has(String(bid))) journalIds.add(String(row.journal_id))
    }
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {{ bookingIds: string[], profileIds: string[], batchIds: string[], payoutIds: string[] }} ctx
 */
async function collectAllTestLedgerJournalIds(sb, ctx) {
  const journalIds = new Set()
  const bookingSet = new Set(ctx.bookingIds)
  const profileSet = new Set(ctx.profileIds)
  const batchSet = new Set(ctx.batchIds)

  for (const bid of ctx.bookingIds) {
    journalIds.add(`lj-cap-${bid}`)
    journalIds.add(`lj-refund-${bid}`.slice(0, 120))
  }
  for (const pid of ctx.payoutIds) {
    journalIds.add(`lj-payout-settled-${pid}`)
  }

  for (const part of chunks(ctx.bookingIds)) {
    if (!part.length) continue
    const { data } = await sb
      .from('ledger_journals')
      .select('id, booking_id, idempotency_key, metadata, event_type')
      .in('booking_id', part)
    for (const row of data || []) if (row?.id) journalIds.add(String(row.id))
  }

  for (const batchId of ctx.batchIds) {
    const { data } = await sb
      .from('ledger_journals')
      .select('id')
      .ilike('id', `lj-batch-settled-${batchId}%`)
    for (const row of data || []) if (row?.id) journalIds.add(String(row.id))
  }

  const { data: metaJournals } = await sb
    .from('ledger_journals')
    .select('id, booking_id, idempotency_key, metadata, event_type')
    .contains('metadata', { is_test_data: true })
    .limit(5000)
  for (const row of metaJournals || []) if (row?.id) journalIds.add(String(row.id))

  const { data: recentJournals } = await sb
    .from('ledger_journals')
    .select('id, booking_id, idempotency_key, metadata, event_type')
    .order('created_at', { ascending: false })
    .limit(LEDGER_SCAN_LIMIT)

  for (const row of recentJournals || []) {
    if (!row?.id) continue
    if (isFintechTestLedgerJournalRow(row)) journalIds.add(String(row.id))
    if (row.booking_id && bookingSet.has(String(row.booking_id))) journalIds.add(String(row.id))
    const partnerId = row.metadata?.partner_id
    if (partnerId && profileSet.has(String(partnerId))) journalIds.add(String(row.id))
    const batchId = row.metadata?.batch_id || row.metadata?.payout_batch_id
    if (batchId && batchSet.has(String(batchId))) journalIds.add(String(row.id))
  }

  const { data: recentEntries } = await sb
    .from('ledger_entries')
    .select('journal_id, metadata, description')
    .order('created_at', { ascending: false })
    .limit(LEDGER_SCAN_LIMIT)

  for (const row of recentEntries || []) {
    if (!row?.journal_id) continue
    if (isFintechTestLedgerEntryRow(row)) journalIds.add(String(row.journal_id))
    const bid = row.metadata?.booking_id
    if (bid && bookingSet.has(String(bid))) journalIds.add(String(row.journal_id))
  }

  await collectAggressiveLedgerPatterns(sb, journalIds, bookingSet)

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
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {{ bookingIds: Set<string>, profileIds: Set<string> }} ctx
 */
async function pruneTreasuryTestAlerts(sb, ctx) {
  const { removed } = await pruneTreasuryOpsAlerts((alert) => isFintechTestTreasuryAlert(alert, ctx))
  return removed
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 */
async function countTestCriticalSignals(sb) {
  let count = 0
  const patterns = [
    `%${E2E_TEST_DATA_TAG}%`,
    '%stage104-financial-smoke%',
    '%stage103-financial-smoke%',
    '%user-smoke-%',
    '%@smoke.invalid%',
    '%financial-smoke%',
    '%smoke%',
    '%lj-payout-settled%',
  ]
  const seen = new Set()
  for (const pattern of patterns) {
    const { data } = await sb
      .from('critical_signal_events')
      .select('id, signal_key, detail, metadata')
      .ilike('detail', pattern)
      .limit(2000)
    for (const row of data || []) {
      if (row?.id && !seen.has(row.id) && isFintechTestCriticalSignalRow(row)) {
        seen.add(row.id)
        count += 1
      }
    }
  }
  const { data: recent } = await sb
    .from('critical_signal_events')
    .select('id, signal_key, detail, metadata')
    .order('created_at', { ascending: false })
    .limit(3000)
  for (const row of recent || []) {
    if (row?.id && !seen.has(row.id) && isFintechTestCriticalSignalRow(row)) {
      seen.add(row.id)
      count += 1
    }
  }
  return count
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 */
async function deleteTestCriticalSignals(sb) {
  let deleted = 0
  const patterns = [
    `%${E2E_TEST_DATA_TAG}%`,
    '%stage104-financial-smoke%',
    '%stage103-financial-smoke%',
    '%user-smoke-%',
    '%@smoke.invalid%',
    '%financial-smoke%',
    '%smoke%',
    '%lj-payout-settled%',
    '%lj-batch-settled%',
  ]
  for (const pattern of patterns) {
    const { count, error } = await sb
      .from('critical_signal_events')
      .delete({ count: 'exact' })
      .ilike('detail', pattern)
    if (!error && typeof count === 'number') deleted += count
    else if (error && !String(error.message || '').includes('does not exist')) {
      console.warn('[fintech-test-cleanup] critical_signal_events:', error.message)
    }
  }
  const { data: recent } = await sb
    .from('critical_signal_events')
    .select('id, signal_key, detail, metadata')
    .order('created_at', { ascending: false })
    .limit(3000)
  const testIds = (recent || []).filter((r) => isFintechTestCriticalSignalRow(r)).map((r) => r.id)
  deleted += await safeDeleteIn(sb, 'critical_signal_events', 'id', testIds)
  return deleted
}

/**
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
      .select('id, listing_id, guest_name, guest_email, special_requests, renter_id, partner_id, metadata')
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
 * @param {{ protectListingIds?: string[] }} [opts]
 */
async function buildCleanupPlan(sb, opts = {}) {
  const bookingIds = await collectTestBookingIds(sb)
  const profileIds = await collectSmokeProfileIds(sb)
  let batchIds = await collectTestBatchIds(sb, bookingIds)
  batchIds = await enrichTestBatchIds(sb, bookingIds, profileIds, batchIds)
  const payoutIds = await collectTestPayoutIds(sb, profileIds)
  const journalIds = await collectAllTestLedgerJournalIds(sb, {
    bookingIds,
    profileIds,
    batchIds,
    payoutIds,
  })
  const ledgerEntryCount = await countLedgerEntriesForJournals(sb, journalIds)
  const conversationIds = bookingIds.length ? await fetchConversationIds(sb, bookingIds) : []

  const alertCtx = {
    bookingIds: new Set(bookingIds),
    profileIds: new Set(profileIds),
  }
  const ops = await import('@/lib/treasury/treasury-ops-config.js').then((m) => m.loadTreasuryOpsSettings())
  const treasuryAlertsWouldRemove = (ops.recentAlerts || []).filter((a) =>
    isFintechTestTreasuryAlert(a, alertCtx),
  ).length

  const listingCleanupPreview = await runCleanupTestData(sb, {
    dryRun: true,
    protectListingIds: opts.protectListingIds,
  })

  const criticalSignalsWouldRemove = await countTestCriticalSignals(sb)

  const counts = {
    bookings: bookingIds.length,
    payoutBatches: batchIds.length,
    profiles: profileIds.length,
    payouts: payoutIds.length,
    ledgerJournals: journalIds.length,
    ledgerEntries: ledgerEntryCount,
    conversations: conversationIds.length,
    listings: listingCleanupPreview.listingCount || 0,
    treasuryAlerts: treasuryAlertsWouldRemove,
    criticalSignals: criticalSignalsWouldRemove,
  }

  const totalExact =
    counts.bookings +
    counts.payoutBatches +
    counts.profiles +
    counts.payouts +
    counts.ledgerJournals +
    counts.ledgerEntries +
    counts.conversations +
    counts.listings +
    counts.treasuryAlerts +
    counts.criticalSignals

  return {
    bookingIds,
    profileIds,
    batchIds,
    payoutIds,
    journalIds,
    conversationIds,
    counts,
    totalExact,
    treasuryAlertsWouldRemove,
    criticalSignalsWouldRemove,
    listingCleanupPreview,
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 */
export async function previewFintechTestDataCleanup(sb) {
  const plan = await buildCleanupPlan(sb)
  return {
    total: plan.totalExact,
    counts: plan.counts,
    breakdown: plan.counts,
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {{ dryRun?: boolean, protectListingIds?: string[] }} [opts]
 */
export async function runFintechTestDataCleanup(sb, opts = {}) {
  const dryRun = opts.dryRun !== false
  const plan = await buildCleanupPlan(sb, opts)

  const report = {
    dryRun,
    bookingIds: plan.bookingIds.length,
    batchIds: plan.batchIds.length,
    profileIds: plan.profileIds.length,
    payoutIds: plan.payoutIds.length,
    journalIds: plan.journalIds.length,
    ledgerEntriesWouldDelete: plan.counts.ledgerEntries,
    conversationIds: plan.conversationIds.length,
    listingCandidates: plan.listingCleanupPreview.listingCount,
    treasuryAlertsWouldRemove: plan.treasuryAlertsWouldRemove,
    criticalSignalsWouldRemove: plan.criticalSignalsWouldRemove,
    counts: plan.counts,
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
      treasury_ops_alerts: 0,
      critical_signal_events: 0,
    },
  }

  if (dryRun) {
    report.totalWouldDelete = plan.totalExact
    return report
  }

  const { bookingIds, batchIds, profileIds, payoutIds, journalIds, conversationIds } = plan

  report.deleted.ledger_entries = await safeDeleteIn(sb, 'ledger_entries', 'journal_id', journalIds)
  report.deleted.ledger_journals = await safeDeleteIn(sb, 'ledger_journals', 'id', journalIds)

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
  report.deleted.treasury_ops_alerts = await pruneTreasuryTestAlerts(sb, {
    bookingIds: new Set(bookingIds),
    profileIds: new Set(profileIds),
  })
  report.deleted.critical_signal_events = await deleteTestCriticalSignals(sb)

  report.totalDeleted = sumFintechCleanupDeleted(report.deleted)
  return report
}
