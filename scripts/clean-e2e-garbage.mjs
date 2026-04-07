#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import path from 'path'
import nextEnv from '@next/env'

const { loadEnvConfig } = nextEnv
loadEnvConfig(path.resolve(process.cwd()))

const TEST_EMAILS = ['86boa@mail.ru', 'pavel29031983@gmail.com', 'pavel_534@mail.ru'].map((x) =>
  String(x).toLowerCase(),
)
const TEST_TAG = '[E2E_TEST_DATA]'
const dryRun = process.argv.includes('--dry-run')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRole) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const sb = createClient(supabaseUrl, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const uniq = (arr) => [...new Set((arr || []).filter(Boolean).map((x) => String(x)))]
const inChunks = (arr, size = 500) => {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function fetchProfileIds() {
  const out = []
  for (const email of TEST_EMAILS) {
    const { data } = await sb.from('profiles').select('id').ilike('email', email).limit(1)
    if (Array.isArray(data) && data[0]?.id) out.push(data[0].id)
  }
  return uniq(out)
}

async function main() {
  const profileIds = await fetchProfileIds()
  const like = `%${TEST_TAG}%`

  const { data: taggedListings } = await sb
    .from('listings')
    .select('id')
    .or(`title.ilike.${like},description.ilike.${like}`)
  let listingIds = uniq((taggedListings || []).map((x) => x.id))

  if (profileIds.length) {
    for (const part of inChunks(profileIds)) {
      const { data } = await sb.from('listings').select('id').in('owner_id', part)
      listingIds = uniq([...listingIds, ...(data || []).map((x) => x.id)])
    }
  }

  const { data: taggedBookings } = await sb
    .from('bookings')
    .select('id,listing_id')
    .or(`special_requests.ilike.${like},guest_name.ilike.${like}`)
  let bookingIds = uniq((taggedBookings || []).map((x) => x.id))
  listingIds = uniq([...listingIds, ...(taggedBookings || []).map((x) => x.listing_id)])

  for (const email of TEST_EMAILS) {
    const { data } = await sb.from('bookings').select('id').ilike('guest_email', email)
    bookingIds = uniq([...bookingIds, ...(data || []).map((x) => x.id)])
  }

  if (profileIds.length) {
    for (const part of inChunks(profileIds)) {
      const { data: byRenter } = await sb.from('bookings').select('id').in('renter_id', part)
      const { data: byPartner } = await sb.from('bookings').select('id').in('partner_id', part)
      bookingIds = uniq([
        ...bookingIds,
        ...(byRenter || []).map((x) => x.id),
        ...(byPartner || []).map((x) => x.id),
      ])
    }
  }
  if (listingIds.length) {
    for (const part of inChunks(listingIds)) {
      const { data } = await sb.from('bookings').select('id').in('listing_id', part)
      bookingIds = uniq([...bookingIds, ...(data || []).map((x) => x.id)])
    }
  }

  let conversationIds = []
  if (bookingIds.length) {
    for (const part of inChunks(bookingIds)) {
      const { data } = await sb.from('conversations').select('id').in('booking_id', part)
      conversationIds = uniq([...conversationIds, ...(data || []).map((x) => x.id)])
    }
  }
  if (listingIds.length) {
    for (const part of inChunks(listingIds)) {
      const { data } = await sb.from('conversations').select('id').in('listing_id', part)
      conversationIds = uniq([...conversationIds, ...(data || []).map((x) => x.id)])
    }
  }
  if (profileIds.length) {
    for (const part of inChunks(profileIds)) {
      const { data: renterRows } = await sb.from('conversations').select('id').in('renter_id', part)
      const { data: partnerRows } = await sb.from('conversations').select('id').in('partner_id', part)
      const { data: ownerRows } = await sb.from('conversations').select('id').in('owner_id', part)
      const { data: adminRows } = await sb.from('conversations').select('id').in('admin_id', part)
      conversationIds = uniq([
        ...conversationIds,
        ...(renterRows || []).map((x) => x.id),
        ...(partnerRows || []).map((x) => x.id),
        ...(ownerRows || []).map((x) => x.id),
        ...(adminRows || []).map((x) => x.id),
      ])
    }
  }

  let messageIds = []
  const { data: taggedMessages } = await sb
    .from('messages')
    .select('id')
    .or(`content.ilike.${like},message.ilike.${like}`)
  messageIds = uniq([...messageIds, ...(taggedMessages || []).map((x) => x.id)])
  if (conversationIds.length) {
    for (const part of inChunks(conversationIds)) {
      const { data } = await sb.from('messages').select('id').in('conversation_id', part)
      messageIds = uniq([...messageIds, ...(data || []).map((x) => x.id)])
    }
  }
  if (profileIds.length) {
    for (const part of inChunks(profileIds)) {
      const { data } = await sb.from('messages').select('id').in('sender_id', part)
      messageIds = uniq([...messageIds, ...(data || []).map((x) => x.id)])
    }
  }

  const report = {
    dryRun,
    profilesMatched: profileIds.length,
    messagesToDelete: messageIds.length,
    conversationsToDelete: conversationIds.length,
    bookingsToDelete: bookingIds.length,
    listingsToDelete: listingIds.length,
  }
  console.log('[clean-e2e-garbage]', report)
  if (dryRun) return

  for (const part of inChunks(messageIds)) if (part.length) await sb.from('messages').delete().in('id', part)
  for (const part of inChunks(conversationIds))
    if (part.length) await sb.from('conversations').delete().in('id', part)
  for (const part of inChunks(bookingIds)) if (part.length) await sb.from('bookings').delete().in('id', part)
  for (const part of inChunks(listingIds)) if (part.length) await sb.from('listings').delete().in('id', part)

  console.log('[clean-e2e-garbage] done')
}

main().catch((e) => {
  console.error('[clean-e2e-garbage] failed:', e?.message || e)
  process.exit(1)
})

