import path from 'path'
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { E2E_TEST_DATA_TAG } from '../lib/e2e/test-data-tag.js'

const MAX_IN = 500

function chunk(arr: string[], size = MAX_IN) {
  const out: string[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function deleteInBatches(sb: any, table: string, column: string, ids: string[]) {
  for (const part of chunk(ids)) {
    if (!part.length) continue
    await sb.from(table).delete().in(column, part)
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

  const { data: taggedBookings } = await sb
    .from('bookings')
    .select('id,listing_id')
    .or(`special_requests.ilike.${like},guest_name.ilike.${like}`)

  const { data: taggedListings } = await sb
    .from('listings')
    .select('id')
    .or(`title.ilike.${like},description.ilike.${like}`)

  const bookingIds = Array.from(new Set((taggedBookings || []).map((b: any) => String(b.id)).filter(Boolean)))
  const listingIds = Array.from(new Set((taggedListings || []).map((l: any) => String(l.id)).filter(Boolean)))
  for (const b of taggedBookings || []) {
    if (b?.listing_id) listingIds.push(String(b.listing_id))
  }

  const uniqueListingIds = Array.from(new Set(listingIds))
  const uniqueBookingIds = Array.from(new Set(bookingIds))

  const conversationIds: string[] = []
  for (const part of chunk(uniqueBookingIds)) {
    if (!part.length) continue
    const { data } = await sb.from('conversations').select('id').in('booking_id', part)
    for (const row of data || []) if (row?.id) conversationIds.push(String(row.id))
  }
  for (const part of chunk(uniqueListingIds)) {
    if (!part.length) continue
    const { data } = await sb.from('conversations').select('id').in('listing_id', part)
    for (const row of data || []) if (row?.id) conversationIds.push(String(row.id))
  }
  const uniqueConversationIds = Array.from(new Set(conversationIds))

  if (uniqueConversationIds.length) {
    await deleteInBatches(sb, 'messages', 'conversation_id', uniqueConversationIds)
    await deleteInBatches(sb, 'conversations', 'id', uniqueConversationIds)
  }

  await sb.from('messages').delete().or(`content.ilike.${like},message.ilike.${like}`)
  if (uniqueBookingIds.length) await deleteInBatches(sb, 'bookings', 'id', uniqueBookingIds)
  if (uniqueListingIds.length) await deleteInBatches(sb, 'listings', 'id', uniqueListingIds)

  console.log(
    `[Playwright teardown] cleaned test artifacts: bookings=${uniqueBookingIds.length}, listings=${uniqueListingIds.length}, conversations=${uniqueConversationIds.length}`,
  )
}

