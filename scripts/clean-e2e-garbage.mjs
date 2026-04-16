#!/usr/bin/env node
/**
 * Снайперская уборка E2E: только брони с маркером [E2E_TEST_DATA] в special_requests / guest_name,
 * плюс сообщения и беседы, привязанные к этим booking_id.
 *
 * Не трогает: profiles, listings, брони без метки, чужие беседы.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (как у Next).
 * Флаги: --dry-run — только отчёт в stdout, без удалений и без записи в ops_job_runs.
 */

import { createClient } from '@supabase/supabase-js'
import path from 'path'
import nextEnv from '@next/env'

const { loadEnvConfig } = nextEnv
loadEnvConfig(path.resolve(process.cwd()))

const TEST_TAG = String(process.env.E2E_TEST_DATA_TAG || '[E2E_TEST_DATA]').trim() || '[E2E_TEST_DATA]'
const LIKE = `%${TEST_TAG}%`
const dryRun = process.argv.includes('--dry-run')
const JOB_NAME = 'clean-e2e-garbage'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRole) {
  console.error('[clean-e2e-garbage] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const sb = createClient(supabaseUrl, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const uniq = (arr) => [...new Set((arr || []).filter(Boolean).map((x) => String(x)))]
const inChunks = (arr, size = 200) => {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function safeDeleteIn(table, column, ids, label) {
  for (const part of inChunks(ids)) {
    if (!part.length) continue
    const { error } = await sb.from(table).delete().in(column, part)
    if (error) console.warn(`[clean-e2e-garbage] ${label || table}:`, error.message)
  }
}

async function fetchTaggedBookingIds() {
  const { data: bySr, error: e1 } = await sb.from('bookings').select('id').ilike('special_requests', LIKE)
  const { data: byGn, error: e2 } = await sb.from('bookings').select('id').ilike('guest_name', LIKE)
  if (e1) console.warn('[clean-e2e-garbage] bookings special_requests:', e1.message)
  if (e2) console.warn('[clean-e2e-garbage] bookings guest_name:', e2.message)
  return uniq([...(bySr || []), ...(byGn || [])].map((r) => r.id))
}

async function fetchConversationIdsForBookings(bookingIds) {
  const out = []
  for (const part of inChunks(bookingIds)) {
    if (!part.length) continue
    const { data, error } = await sb.from('conversations').select('id').in('booking_id', part)
    if (error) {
      console.warn('[clean-e2e-garbage] conversations:', error.message)
      continue
    }
    for (const row of data || []) if (row?.id) out.push(String(row.id))
  }
  return uniq(out)
}

async function logOpsJobRun({ status, stats, errorMessage, startedAt }) {
  const payload = {
    job_name: JOB_NAME,
    status,
    started_at: startedAt || new Date().toISOString(),
    finished_at: new Date().toISOString(),
    stats: stats && typeof stats === 'object' ? stats : {},
    error_message: errorMessage ? String(errorMessage).slice(0, 1000) : null,
  }
  const { error } = await sb.from('ops_job_runs').insert(payload)
  if (error && !String(error.message || '').includes("Could not find the table")) {
    console.warn('[clean-e2e-garbage] ops_job_runs:', error.message)
  }
}

async function main() {
  const started = Date.now()
  const jobStartedAt = new Date().toISOString()
  const bookingIds = await fetchTaggedBookingIds()
  const conversationIds = bookingIds.length ? await fetchConversationIdsForBookings(bookingIds) : []

  const report = {
    dryRun,
    marker: TEST_TAG,
    taggedBookings: bookingIds.length,
    linkedConversations: conversationIds.length,
  }
  console.log('[clean-e2e-garbage]', report)

  if (dryRun) {
    console.log('[clean-e2e-garbage] dry-run — БД не изменена, ops_job_runs не пишем')
    return
  }

  let deletedMessages = 0
  let deletedPayments = 0
  let deletedInvoices = 0

  for (const part of inChunks(conversationIds)) {
    if (!part.length) continue
    const { count, error } = await sb.from('messages').delete({ count: 'exact' }).in('conversation_id', part)
    if (!error && typeof count === 'number') deletedMessages += count
    if (error) console.warn('[clean-e2e-garbage] messages:', error.message)
  }

  await safeDeleteIn('telegram_chat_reply_map', 'conversation_id', conversationIds, 'telegram_chat_reply_map')

  for (const part of inChunks(bookingIds)) {
    if (!part.length) continue
    const { count, error } = await sb.from('payments').delete({ count: 'exact' }).in('booking_id', part)
    if (!error && typeof count === 'number') deletedPayments += count
    if (error && !String(error.message || '').includes('does not exist')) {
      console.warn('[clean-e2e-garbage] payments:', error.message)
    }
  }

  for (const part of inChunks(bookingIds)) {
    if (!part.length) continue
    const { count, error } = await sb.from('invoices').delete({ count: 'exact' }).in('booking_id', part)
    if (!error && typeof count === 'number') deletedInvoices += count
    if (error && !String(error.message || '').includes('does not exist')) {
      console.warn('[clean-e2e-garbage] invoices (by booking_id):', error.message)
    }
  }

  await safeDeleteIn('conversations', 'id', conversationIds)
  await safeDeleteIn('bookings', 'id', bookingIds)

  const durationMs = Date.now() - started
  const summaryRu =
    `Уборка завершена. Удалено тестовых броней: ${bookingIds.length}. ` +
    `Личные данные пользователя не затронуты (profiles и listings не удалялись).`

  await logOpsJobRun({
    status: 'success',
    startedAt: jobStartedAt,
    stats: {
      summary_ru: summaryRu,
      deleted_bookings: bookingIds.length,
      deleted_conversations: conversationIds.length,
      deleted_messages: deletedMessages,
      deleted_payments: deletedPayments,
      deleted_invoices: deletedInvoices,
      duration_ms: durationMs,
      marker: TEST_TAG,
    },
    errorMessage: null,
  })

  console.log('[clean-e2e-garbage] done:', { ...report, deletedMessages, deletedPayments, deletedInvoices, durationMs })
  console.log('[clean-e2e-garbage]', summaryRu)
}

main().catch(async (e) => {
  const msg = e?.message || String(e)
  console.error('[clean-e2e-garbage] failed:', msg)
  if (!dryRun) {
    await logOpsJobRun({
      status: 'error',
      startedAt: new Date().toISOString(),
      stats: {
        summary_ru: 'Уборка E2E завершилась с ошибкой. БД могла быть изменена частично.',
        marker: TEST_TAG,
      },
      errorMessage: msg,
    })
  }
  process.exit(1)
})
