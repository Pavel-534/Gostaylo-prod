import path from 'path'
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { E2E_TEST_DATA_TAG } from '../lib/e2e/test-data-tag.js'

const MAX_IN = 200

function chunk(arr: string[], size = MAX_IN) {
  const out: string[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function deleteInBatches(sb: ReturnType<typeof createClient>, table: string, column: string, ids: string[]) {
  for (const part of chunk(ids)) {
    if (!part.length) continue
    const { error } = await sb.from(table).delete().in(column, part)
    if (error && !String(error.message || '').includes('does not exist')) {
      console.warn(`[Playwright teardown] ${table}:`, error.message)
    }
  }
}

export default async function globalTeardown() {
  loadEnvConfig(path.resolve(process.cwd()))

  if (process.env.RUN_PRODUCTION_SMOKE === '1') {
    console.warn(
      '[Playwright teardown] skipped: RUN_PRODUCTION_SMOKE=1 (не трогаем БД после прогона по прод-домену)',
    )
    return
  }
  if (process.env.PLAYWRIGHT_SKIP_GLOBAL_TEARDOWN === '1') {
    console.warn('[Playwright teardown] skipped: PLAYWRIGHT_SKIP_GLOBAL_TEARDOWN=1')
    return
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRole) {
    console.warn('[Playwright teardown] skip cleanup: missing Supabase env')
    return
  }

  const sb = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const like = `%${E2E_TEST_DATA_TAG}%`

  const { data: bySr } = await sb.from('bookings').select('id').ilike('special_requests', like)
  const { data: byGn } = await sb.from('bookings').select('id').ilike('guest_name', like)
  const bookingIds = Array.from(
    new Set([...(bySr || []), ...(byGn || [])].map((b: { id?: string }) => String(b.id)).filter(Boolean)),
  )

  const conversationIds: string[] = []
  for (const part of chunk(bookingIds)) {
    if (!part.length) continue
    const { data } = await sb.from('conversations').select('id').in('booking_id', part)
    for (const row of data || []) if (row?.id) conversationIds.push(String(row.id))
  }
  const uniqueConversationIds = Array.from(new Set(conversationIds))

  for (const part of chunk(uniqueConversationIds)) {
    if (!part.length) continue
    await sb.from('messages').delete().in('conversation_id', part)
  }
  await deleteInBatches(sb, 'telegram_chat_reply_map', 'conversation_id', uniqueConversationIds)
  await deleteInBatches(sb, 'payments', 'booking_id', bookingIds)
  await deleteInBatches(sb, 'invoices', 'booking_id', bookingIds)
  if (uniqueConversationIds.length) await deleteInBatches(sb, 'conversations', 'id', uniqueConversationIds)
  if (bookingIds.length) await deleteInBatches(sb, 'bookings', 'id', bookingIds)

  console.log(
    `[Playwright teardown] surgical E2E cleanup: bookings=${bookingIds.length}, conversations=${uniqueConversationIds.length} (listings/profiles не трогаем)`,
  )
}
