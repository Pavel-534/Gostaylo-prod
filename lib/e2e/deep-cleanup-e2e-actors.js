/**
 * Глубокая уборка E2E-акторов (профили, рефералка, кошельки, листинги/брони тестовых пользователей).
 * Критерии — консервативные: только явные тестовые паттерны (домен email, префиксы id).
 *
 * Не вызывать против прод-аккаунтов. Предпочтительно: staging или после PLAYWRIGHT с флагом.
 */

const CHUNK = 200
const PROTECTED_EMAILS = new Set([
  'pavel_534@mail.ru',
  '86boa@mail.ru',
  'pavel29031983@gmail.ru',
])

function uniq(arr) {
  return [...new Set((arr || []).filter(Boolean).map((x) => String(x)))]
}

function chunks(arr, size = CHUNK) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function normalizeEmail(v) {
  return String(v || '').trim().toLowerCase()
}

function parsePublicStorageRef(urlRaw) {
  const url = String(urlRaw || '').trim()
  if (!url) return null
  const m1 = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/i)
  if (m1) return { bucket: decodeURIComponent(m1[1]), path: decodeURIComponent(m1[2]) }
  const m2 = url.match(/\/_storage\/([^/]+)\/(.+)$/i)
  if (m2) return { bucket: decodeURIComponent(m2[1]), path: decodeURIComponent(m2[2]) }
  return null
}

function collectStorageRefsFromListingRow(row) {
  const refs = []
  const img = row?.cover_image
  if (img) refs.push(img)
  const arr = Array.isArray(row?.images) ? row.images : []
  for (const item of arr) refs.push(item)
  return refs
    .map(parsePublicStorageRef)
    .filter((x) => x && x.bucket && x.path)
}

function collectStorageRefsFromProfileRow(row) {
  const refs = []
  if (row?.avatar_url) refs.push(row.avatar_url)
  if (row?.avatarUrl) refs.push(row.avatarUrl)
  return refs
    .map(parsePublicStorageRef)
    .filter((x) => x && x.bucket && x.path)
}

async function safeDeleteIn(sb, table, column, ids, label) {
  for (const part of chunks(ids)) {
    if (!part.length) continue
    const { error } = await sb.from(table).delete().in(column, part)
    if (error && !String(error.message || '').includes('does not exist')) {
      console.warn(`[e2e-deep-cleanup] ${label || table}:`, error.message)
    }
  }
}

/**
 * @param {*} sb — Supabase client (service role)
 * @param {{ dryRun?: boolean }} [opts]
 * @returns {Promise<{ profileIds: string[], listingIds: string[], bookingIds: string[], dryRun: boolean }>}
 */
export async function collectE2eTestActorIds(sb, opts = {}) {
  const dryRun = opts.dryRun === true
  const protectedEmails = new Set([...PROTECTED_EMAILS, ...(opts.protectedEmails || [])].map(normalizeEmail))
  const profileIdToEmail = new Map()

  const { data: byEmail, error: e1 } = await sb
    .from('profiles')
    .select('id,email')
    .ilike('email', '%@test.gostaylo.invalid')
  if (e1) console.warn('[e2e-deep-cleanup] profiles by email:', e1.message)
  for (const row of byEmail || []) {
    const id = String(row?.id || '').trim()
    const email = normalizeEmail(row?.email)
    if (!id || protectedEmails.has(email)) continue
    profileIdToEmail.set(id, email)
  }

  const { data: byPrefix, error: e2 } = await sb
    .from('profiles')
    .select('id,email')
    .or('id.like.user-s72-%,id.like.user-x71-%')
  if (e2) console.warn('[e2e-deep-cleanup] profiles by id prefix:', e2.message)
  for (const row of byPrefix || []) {
    const id = String(row?.id || '').trim()
    const email = normalizeEmail(row?.email)
    if (!id || protectedEmails.has(email)) continue
    if (!profileIdToEmail.has(id)) profileIdToEmail.set(id, email)
  }

  const p = [...profileIdToEmail.keys()]
  if (!p.length) {
    return { profileIds: [], listingIds: [], bookingIds: [], dryRun, protectedEmails: [...protectedEmails] }
  }

  const listingIds = new Set()
  const listingStorageRefs = []
  const profileStorageRefs = []
  for (const part of chunks(p)) {
    const { data, error } = await sb.from('listings').select('id,images,cover_image').in('owner_id', part)
    if (error) {
      console.warn('[e2e-deep-cleanup] listings:', error.message)
      continue
    }
    for (const row of data || []) {
      if (row?.id) listingIds.add(String(row.id))
      listingStorageRefs.push(...collectStorageRefsFromListingRow(row))
    }
  }

  for (const part of chunks(p)) {
    const { data, error } = await sb.from('profiles').select('id,avatar_url').in('id', part)
    if (error) {
      console.warn('[e2e-deep-cleanup] profiles avatar refs:', error.message)
      continue
    }
    for (const row of data || []) {
      profileStorageRefs.push(...collectStorageRefsFromProfileRow(row))
    }
  }

  const bookingIds = new Set()
  for (const part of chunks(p)) {
    const { data: br, error: er1 } = await sb.from('bookings').select('id').in('renter_id', part)
    if (!er1) for (const row of br || []) if (row?.id) bookingIds.add(String(row.id))
    else console.warn('[e2e-deep-cleanup] bookings renter:', er1.message)

    const { data: bp, error: er2 } = await sb.from('bookings').select('id').in('partner_id', part)
    if (!er2) for (const row of bp || []) if (row?.id) bookingIds.add(String(row.id))
    else if (!String(er2.message || '').includes('does not exist')) {
      console.warn('[e2e-deep-cleanup] bookings partner:', er2.message)
    }
  }
  for (const part of chunks([...listingIds])) {
    if (!part.length) continue
    const { data: bl, error: er3 } = await sb.from('bookings').select('id').in('listing_id', part)
    if (!er3) for (const row of bl || []) if (row?.id) bookingIds.add(String(row.id))
    else console.warn('[e2e-deep-cleanup] bookings listing:', er3.message)
  }

  return {
    profileIds: p,
    listingIds: [...listingIds],
    bookingIds: [...bookingIds],
    dryRun,
    protectedEmails: [...protectedEmails],
    listingStorageRefs,
    profileStorageRefs,
  }
}

/**
 * @param {*} sb
 * @param {{ dryRun?: boolean }} [opts]
 */
export async function deepCleanupE2eTestActors(sb, opts = {}) {
  const { profileIds, listingIds, bookingIds, dryRun, protectedEmails, listingStorageRefs, profileStorageRefs } =
    await collectE2eTestActorIds(sb, opts)

  const report = {
    dryRun,
    profileCount: profileIds.length,
    listingCount: listingIds.length,
    bookingCount: bookingIds.length,
    protectedEmails,
    storageObjectsDeleted: 0,
    storageObjectsPlanned:
      (Array.isArray(listingStorageRefs) ? listingStorageRefs.length : 0) +
      (Array.isArray(profileStorageRefs) ? profileStorageRefs.length : 0),
  }

  if (!profileIds.length) {
    console.log('[e2e-deep-cleanup] no matching test profiles — skip')
    return report
  }

  if (dryRun) {
    console.log('[e2e-deep-cleanup] dry-run', report)
    return report
  }

  const conversationIds = []
  for (const part of chunks(bookingIds)) {
    if (!part.length) continue
    const { data } = await sb.from('conversations').select('id').in('booking_id', part)
    for (const row of data || []) if (row?.id) conversationIds.push(String(row.id))
  }
  const convU = uniq(conversationIds)

  for (const part of chunks(convU)) {
    if (!part.length) continue
    await sb.from('messages').delete().in('conversation_id', part)
  }
  await safeDeleteIn(sb, 'telegram_chat_reply_map', 'conversation_id', convU)
  await safeDeleteIn(sb, 'payments', 'booking_id', bookingIds)
  await safeDeleteIn(sb, 'invoices', 'booking_id', bookingIds)
  await safeDeleteIn(sb, 'conversations', 'id', convU)

  await safeDeleteIn(sb, 'bookings', 'id', bookingIds)

  for (const part of chunks(bookingIds)) {
    if (!part.length) continue
    await sb.from('referral_ledger').delete().in('booking_id', part)
  }

  for (const part of chunks(profileIds)) {
    if (!part.length) continue
    await sb.from('referral_ledger').delete().in('referrer_id', part)
    await sb.from('referral_ledger').delete().in('referee_id', part)
  }

  for (const part of chunks(profileIds)) {
    if (!part.length) continue
    await sb.from('referral_relations').delete().in('referrer_id', part)
    await sb.from('referral_relations').delete().in('referee_id', part)
  }

  await safeDeleteIn(sb, 'referral_codes', 'user_id', profileIds)

  // Delete listing images via Storage API first (Supabase disallows deleting storage.objects directly).
  const bucketToPaths = new Map()
  for (const ref of [...(listingStorageRefs || []), ...(profileStorageRefs || [])]) {
    if (!ref?.bucket || !ref?.path) continue
    const arr = bucketToPaths.get(ref.bucket) || []
    arr.push(ref.path)
    bucketToPaths.set(ref.bucket, arr)
  }
  for (const [bucket, paths] of bucketToPaths.entries()) {
    const uniquePaths = uniq(paths)
    for (const part of chunks(uniquePaths)) {
      if (!part.length) continue
      const { error } = await sb.storage.from(bucket).remove(part)
      if (error) {
        console.warn(`[e2e-deep-cleanup] storage remove ${bucket}:`, error.message)
      } else {
        report.storageObjectsDeleted += part.length
      }
    }
  }

  await safeDeleteIn(sb, 'listings', 'id', listingIds)

  await safeDeleteIn(sb, 'profiles', 'id', profileIds)

  console.log('[e2e-deep-cleanup] done', report)
  return report
}
