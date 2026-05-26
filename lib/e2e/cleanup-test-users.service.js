/**
 * Stage 117.3 — агрессивная очистка тестовых пользователей (profiles + auth + связанные сущности).
 */

import {
  collectStorageRefsFromListingRow,
  listListingStoragePathsWithThumbs,
} from './test-listing-cleanup.js'
import {
  isTestProfileRow,
  PROTECTED_TEST_CLEANUP_EMAILS,
  buildTestProfileIdOrFilter,
  TEST_PROFILE_EMAIL_ILIKE,
  normalizeCleanupEmail,
} from './test-user-markers.js'
const CHUNK = 150
const LEDGER_JOURNAL_ILIKE = [
  'lj-payout-settled%',
  'lj-batch-settled%',
  '%smoke%',
  '%stage104%',
  '%stage103%',
  '%user-smoke%',
  '%financial-smoke%',
]
const PROFILE_SCAN_LIMIT = 5000

function partnerLedgerAccountId(partnerId) {
  return `la-partner-${partnerId}`
}

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || ''))
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
      console.warn(`[cleanup-test-users] ${label || table}:`, error.message)
    } else if (typeof count === 'number') {
      deleted += count
    }
  }
  return deleted
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {{ protectedEmails?: string[] }} [opts]
 */
export async function collectAggressiveTestProfileIds(sb, opts = {}) {
  const protectedEmails = new Set([
    ...PROTECTED_TEST_CLEANUP_EMAILS,
    ...(opts.protectedEmails || []).map(normalizeCleanupEmail),
  ])
  const markerOpts = { protectedEmails }
  const byId = new Map()

  const ingest = (rows) => {
    for (const row of rows || []) {
      if (!isTestProfileRow(row, markerOpts)) continue
      byId.set(String(row.id), {
        id: String(row.id),
        email: row.email,
        first_name: row.first_name,
        role: row.role,
      })
    }
  }

  const cols = 'id, email, first_name, last_name, role'

  async function queryProfiles(label, builder) {
    const { data, error } = await builder(sb.from('profiles').select(cols))
    if (error) {
      console.warn(`[cleanup-test-users] profiles ${label}:`, error.message)
      return []
    }
    return data || []
  }

  ingest(await queryProfiles('id-prefix', (q) => q.or(buildTestProfileIdOrFilter())))
  ingest(await queryProfiles('user-smoke-id', (q) => q.ilike('id', 'user-smoke-%')))

  for (const pattern of TEST_PROFILE_EMAIL_ILIKE) {
    ingest(await queryProfiles(`email:${pattern}`, (q) => q.ilike('email', pattern)))
  }

  ingest(await queryProfiles('first_name Smoke%', (q) => q.ilike('first_name', 'Smoke%')))
  ingest(await queryProfiles('first_name User%', (q) => q.ilike('first_name', 'User%')))

  ingest(
    await queryProfiles('recent-scan', (q) =>
      q.order('created_at', { ascending: false }).limit(PROFILE_SCAN_LIMIT),
    ),
  )

  return {
    profileIds: [...byId.keys()],
    candidates: [...byId.values()],
    protectedEmails: [...protectedEmails],
  }
}

async function fetchListingIdsForOwners(sb, profileIds) {
  const listingIds = new Set()
  const listingRows = []
  for (const part of chunks(profileIds)) {
    const { data, error } = await sb.from('listings').select('id, owner_id, images, cover_image').in('owner_id', part)
    if (error) {
      console.warn('[cleanup-test-users] listings by owner:', error.message)
      continue
    }
    for (const row of data || []) {
      if (row?.id) {
        listingIds.add(String(row.id))
        listingRows.push(row)
      }
    }
  }
  return { listingIds: [...listingIds], listingRows }
}

async function fetchBookingIdsForProfiles(sb, profileIds, listingIds) {
  const bookingIds = new Set()
  for (const part of chunks(profileIds)) {
    const { data: br } = await sb.from('bookings').select('id').in('renter_id', part)
    for (const row of br || []) if (row?.id) bookingIds.add(String(row.id))
    const { data: bp } = await sb.from('bookings').select('id').in('partner_id', part)
    for (const row of bp || []) if (row?.id) bookingIds.add(String(row.id))
  }
  for (const part of chunks(listingIds)) {
    const { data: bl } = await sb.from('bookings').select('id').in('listing_id', part)
    for (const row of bl || []) if (row?.id) bookingIds.add(String(row.id))
  }
  return [...bookingIds]
}

async function collectBatchIdsForCleanup(sb, bookingIds, profileIds) {
  const batchIds = new Set()
  for (const part of chunks(bookingIds)) {
    const { data } = await sb.from('payout_batch_items').select('batch_id').in('booking_id', part)
    for (const row of data || []) if (row?.batch_id) batchIds.add(String(row.batch_id))
  }
  const { data: byPb } = await sb.from('payout_batches').select('id').or('id.ilike.pb-stage%,id.ilike.%smoke%')
  for (const row of byPb || []) if (row?.id) batchIds.add(String(row.id))
  for (const part of chunks(profileIds)) {
    const { data } = await sb.from('payout_batches').select('id').in('created_by', part)
    for (const row of data || []) if (row?.id) batchIds.add(String(row.id))
  }
  return [...batchIds]
}

async function collectLedgerJournalIds(sb, { bookingIds, batchIds }) {
  const journalIds = new Set()
  for (const pattern of LEDGER_JOURNAL_ILIKE) {
    const { data } = await sb.from('ledger_journals').select('id').ilike('id', pattern).limit(5000)
    for (const row of data || []) if (row?.id) journalIds.add(String(row.id))
  }
  for (const bid of bookingIds) {
    journalIds.add(`lj-payout-settled-${bid}`)
    journalIds.add(`lj-cap-${bid}`)
  }
  for (const batchId of batchIds) {
    journalIds.add(`lj-batch-settled-${batchId}`)
  }
  return [...journalIds]
}

async function fetchConversationIds(sb, bookingIds) {
  const out = []
  for (const part of chunks(bookingIds)) {
    const { data, error } = await sb.from('conversations').select('id').in('booking_id', part)
    if (error) continue
    for (const row of data || []) if (row?.id) out.push(String(row.id))
  }
  return uniq(out)
}

async function deleteStorageForListings(sb, listingRows, dryRun) {
  const storageRefs = []
  for (const row of listingRows) {
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
  let deleted = 0
  if (dryRun) {
    return [...bucketToPaths.entries()].reduce((n, [, p]) => n + uniq(p).length, 0)
  }
  for (const [bucket, paths] of bucketToPaths.entries()) {
    for (const part of chunks(uniq(paths))) {
      if (!part.length) continue
      const { error } = await sb.storage.from(bucket).remove(part)
      if (!error) deleted += part.length
    }
  }
  return deleted
}

async function resolveAuthUserIds(sb, profileIds) {
  const authIds = new Set()
  for (const part of chunks(profileIds)) {
    const { data, error } = await sb.from('profiles').select('id, auth_user_id').in('id', part)
    if (error) {
      console.warn('[cleanup-test-users] profiles auth_user_id:', error.message)
      continue
    }
    for (const row of data || []) {
      if (isUuid(row?.auth_user_id)) authIds.add(String(row.auth_user_id))
    }
  }
  return [...authIds]
}

async function deleteAuthUsers(sb, authUserIds) {
  let deleted = 0
  let failed = 0
  for (const id of authUserIds) {
    try {
      const { error } = await sb.auth.admin.deleteUser(id)
      if (error) {
        failed += 1
        if (!String(error.message || '').includes('not found')) {
          console.warn(`[cleanup-test-users] auth.deleteUser ${id}:`, error.message)
        }
      } else {
        deleted += 1
      }
    } catch (e) {
      failed += 1
      console.warn(`[cleanup-test-users] auth.deleteUser ${id}:`, e?.message || e)
    }
  }
  return { deleted, failed }
}

async function deletePartnerLedgerAccounts(sb, profileIds) {
  const accountIds = profileIds.map(partnerLedgerAccountId)
  const entriesDeleted = await safeDeleteIn(sb, 'ledger_entries', 'account_id', accountIds)
  const accountsDeleted = await safeDeleteIn(sb, 'ledger_accounts', 'partner_id', profileIds)
  return { entriesDeleted, accountsDeleted }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {{ dryRun?: boolean, protectedEmails?: string[] }} [opts]
 */
export async function runAggressiveTestUserCleanup(sb, opts = {}) {
  const dryRun = opts.dryRun !== false
  const { profileIds, candidates } = await collectAggressiveTestProfileIds(sb, opts)

  const report = {
    dryRun,
    profileCount: profileIds.length,
    candidates,
    listingCount: 0,
    bookingCount: 0,
    conversationCount: 0,
    deleted: {
      messages: 0,
      conversations: 0,
      payments: 0,
      invoices: 0,
      payouts: 0,
      payout_batch_items: 0,
      payout_batches: 0,
      ledger_entries: 0,
      ledger_journals: 0,
      ledger_accounts: 0,
      bookings: 0,
      listings: 0,
      wallet_transactions: 0,
      user_wallets: 0,
      referral_ledger: 0,
      marketing_promo_tank_ledger: 0,
      referral_relations: 0,
      referral_codes: 0,
      profiles: 0,
      auth_users: 0,
      storageObjects: 0,
    },
  }

  if (!profileIds.length) {
    return report
  }

  const { listingIds, listingRows } = await fetchListingIdsForOwners(sb, profileIds)
  const bookingIds = await fetchBookingIdsForProfiles(sb, profileIds, listingIds)
  const conversationIds = bookingIds.length ? await fetchConversationIds(sb, bookingIds) : []

  const batchIds = await collectBatchIdsForCleanup(sb, bookingIds, profileIds)
  const journalIds = await collectLedgerJournalIds(sb, { bookingIds, batchIds })

  report.listingCount = listingIds.length
  report.bookingCount = bookingIds.length
  report.conversationCount = conversationIds.length

  if (dryRun) {
    report.storagePathsPlanned = await deleteStorageForListings(sb, listingRows, true)
    return report
  }

  report.deleted.storageObjects = await deleteStorageForListings(sb, listingRows, false)

  report.deleted.ledger_entries = await safeDeleteIn(sb, 'ledger_entries', 'journal_id', journalIds)
  report.deleted.ledger_journals = await safeDeleteIn(sb, 'ledger_journals', 'id', journalIds)

  const ledgerAcct = await deletePartnerLedgerAccounts(sb, profileIds)
  report.deleted.ledger_entries += ledgerAcct.entriesDeleted
  report.deleted.ledger_accounts = ledgerAcct.accountsDeleted

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
  report.deleted.payouts = await safeDeleteIn(sb, 'payouts', 'partner_id', profileIds)
  report.deleted.bookings = await safeDeleteIn(sb, 'bookings', 'id', bookingIds)

  report.deleted.referral_ledger += await safeDeleteIn(sb, 'referral_ledger', 'booking_id', bookingIds)
  report.deleted.marketing_promo_tank_ledger += await safeDeleteIn(
    sb,
    'marketing_promo_tank_ledger',
    'booking_id',
    bookingIds,
  )
  for (const part of chunks(profileIds)) {
    report.deleted.referral_ledger += await safeDeleteIn(sb, 'referral_ledger', 'referrer_id', part)
    report.deleted.referral_ledger += await safeDeleteIn(sb, 'referral_ledger', 'referee_id', part)
    report.deleted.referral_relations += await safeDeleteIn(sb, 'referral_relations', 'referrer_id', part)
    report.deleted.referral_relations += await safeDeleteIn(sb, 'referral_relations', 'referee_id', part)
  }
  report.deleted.referral_codes = await safeDeleteIn(sb, 'referral_codes', 'user_id', profileIds)

  report.deleted.wallet_transactions = await safeDeleteIn(sb, 'wallet_transactions', 'user_id', profileIds)
  report.deleted.user_wallets = await safeDeleteIn(sb, 'user_wallets', 'user_id', profileIds)

  await safeDeleteIn(sb, 'favorites', 'user_id', profileIds)
  await safeDeleteIn(sb, 'reviews', 'author_id', profileIds)
  await safeDeleteIn(sb, 'reviews', 'reviewee_id', profileIds)
  await safeDeleteIn(sb, 'partner_payout_profiles', 'partner_id', profileIds)
  await safeDeleteIn(sb, 'promo_codes', 'created_by', profileIds)

  report.deleted.listings = await safeDeleteIn(sb, 'listings', 'id', listingIds)

  report.deleted.profiles = await safeDeleteIn(sb, 'profiles', 'id', profileIds)

  const authUserIds = await resolveAuthUserIds(sb, profileIds)
  const authResult = await deleteAuthUsers(sb, authUserIds)
  report.deleted.auth_users = authResult.deleted
  report.authDeleteFailed = authResult.failed

  return report
}
