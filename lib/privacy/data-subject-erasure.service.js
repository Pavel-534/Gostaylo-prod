/**
 * Stage 168.1 — account erasure queue + anonymization (ledger preserved).
 */

import { createHash, randomUUID } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { clearGostayloSessionCookie } from '@/lib/auth/app-session-issue'

export const ERASURE_GRACE_DAYS = 30

const ACTIVE_BOOKING_BLOCK_STATUSES = new Set([
  'PENDING',
  'AWAITING_PAYMENT',
  'CONFIRMED',
  'PAID',
  'PAID_ESCROW',
  'THAWED',
  'READY_FOR_PAYOUT',
])

/**
 * @param {string} userId
 */
function anonymizedEmailFor(userId) {
  const hash = createHash('sha256').update(`erasure:v1:${userId}`).digest('hex').slice(0, 20)
  return `deleted+${hash}@anonymized.invalid`
}

/**
 * @param {string} userId
 */
export async function getActiveErasureRequest(userId) {
  const { data } = await supabaseAdmin
    .from('data_erasure_requests')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['pending_grace', 'processing'])
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data || null
}

/**
 * @param {string} userId
 */
export async function getErasureStatusForUser(userId) {
  const row = await getActiveErasureRequest(userId)
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('data_erasure_completed_at')
    .eq('id', userId)
    .maybeSingle()

  return {
    completed_at: profile?.data_erasure_completed_at ?? null,
    active_request: row
      ? {
          id: row.id,
          status: row.status,
          requested_at: row.requested_at,
          scheduled_for: row.scheduled_for,
          reason: row.reason,
        }
      : null,
    grace_days: ERASURE_GRACE_DAYS,
  }
}

/**
 * @param {string} userId
 * @param {{ reason?: string }} [opts]
 */
export async function requestDataErasure(userId, opts = {}) {
  const uid = String(userId)

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, role, data_erasure_completed_at')
    .eq('id', uid)
    .maybeSingle()

  if (!profile) return { ok: false, error: 'PROFILE_NOT_FOUND' }
  if (profile.data_erasure_completed_at) {
    return { ok: false, error: 'ALREADY_ERASED' }
  }

  const role = String(profile.role || '').toUpperCase()
  if (role === 'ADMIN' || role === 'MODERATOR') {
    return { ok: false, error: 'STAFF_ACCOUNT' }
  }

  const existing = await getActiveErasureRequest(uid)
  if (existing) {
    return { ok: true, duplicate: true, request: existing }
  }

  const { count: activeListings } = await supabaseAdmin
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', uid)
    .eq('status', 'ACTIVE')

  if ((activeListings || 0) > 0) {
    return { ok: false, error: 'ACTIVE_LISTINGS', detail: 'Deactivate active listings before erasure.' }
  }

  const { data: openBookings } = await supabaseAdmin
    .from('bookings')
    .select('id, status')
    .or(`renter_id.eq.${uid},partner_id.eq.${uid}`)
    .limit(50)

  const blocking = (openBookings || []).filter((b) =>
    ACTIVE_BOOKING_BLOCK_STATUSES.has(String(b.status || '').toUpperCase()),
  )
  if (blocking.length > 0) {
    return {
      ok: false,
      error: 'ACTIVE_BOOKINGS',
      detail: 'Complete or cancel active bookings before requesting erasure.',
      booking_ids: blocking.map((b) => b.id),
    }
  }

  const now = new Date()
  const scheduled = new Date(now.getTime() + ERASURE_GRACE_DAYS * 24 * 60 * 60 * 1000)

  const row = {
    id: randomUUID(),
    user_id: uid,
    status: 'pending_grace',
    requested_at: now.toISOString(),
    scheduled_for: scheduled.toISOString(),
    reason: opts.reason ? String(opts.reason).slice(0, 2000) : null,
    metadata: {},
    updated_at: now.toISOString(),
  }

  const { data, error } = await supabaseAdmin
    .from('data_erasure_requests')
    .insert(row)
    .select('*')
    .single()

  if (error) {
    console.error('[data-erasure] request insert failed', error.message)
    return { ok: false, error: 'DATABASE_ERROR' }
  }

  return { ok: true, request: data }
}

/**
 * @param {string} userId
 */
export async function cancelDataErasure(userId) {
  const active = await getActiveErasureRequest(userId)
  if (!active || active.status !== 'pending_grace') {
    return { ok: false, error: 'NO_ACTIVE_REQUEST' }
  }

  const now = new Date().toISOString()
  const { error } = await supabaseAdmin
    .from('data_erasure_requests')
    .update({ status: 'cancelled', cancelled_at: now, updated_at: now })
    .eq('id', active.id)
    .eq('user_id', userId)
    .eq('status', 'pending_grace')

  if (error) return { ok: false, error: 'DATABASE_ERROR' }
  return { ok: true }
}

/**
 * @param {string} userId
 * @param {string} requestId
 */
export async function executeErasureForUser(userId, requestId) {
  const uid = String(userId)
  const now = new Date().toISOString()
  const email = anonymizedEmailFor(uid)

  await supabaseAdmin
    .from('data_erasure_requests')
    .update({ status: 'processing', updated_at: now })
    .eq('id', requestId)
    .eq('user_id', uid)

  await supabaseAdmin.from('favorites').delete().eq('user_id', uid)
  await supabaseAdmin.from('listing_views').delete().eq('user_id', uid)
  await supabaseAdmin.from('user_push_tokens').delete().eq('user_id', uid)

  await supabaseAdmin
    .from('listings')
    .update({
      status: 'INACTIVE',
      available: false,
      updated_at: now,
    })
    .eq('owner_id', uid)
    .neq('status', 'INACTIVE')

  await supabaseAdmin
    .from('profiles')
    .update({
      first_name: 'Deleted',
      last_name: 'User',
      phone: null,
      avatar: null,
      telegram_id: null,
      telegram_username: null,
      telegram_linked: false,
      notification_preferences: {},
      is_banned: true,
      data_erasure_completed_at: now,
      updated_at: now,
      email,
    })
    .eq('id', uid)

  try {
    await supabaseAdmin.auth.admin.updateUserById(uid, {
      ban_duration: '876600h',
      email,
    })
  } catch (e) {
    console.warn('[data-erasure] auth ban/email update:', e?.message || e)
  }

  await supabaseAdmin
    .from('data_erasure_requests')
    .update({
      status: 'completed',
      completed_at: now,
      updated_at: now,
      metadata: { anonymized_email: email },
    })
    .eq('id', requestId)

  return { ok: true, anonymized_email: email }
}

/**
 * Process all due erasure requests (cron).
 */
export async function processDueErasureRequests() {
  const now = new Date().toISOString()
  const { data: due, error } = await supabaseAdmin
    .from('data_erasure_requests')
    .select('id, user_id')
    .eq('status', 'pending_grace')
    .lte('scheduled_for', now)
    .limit(50)

  if (error) {
    console.error('[data-erasure] due query failed', error.message)
    return { processed: 0, errors: [error.message] }
  }

  let processed = 0
  const errors = []

  for (const row of due || []) {
    try {
      const result = await executeErasureForUser(row.user_id, row.id)
      if (result.ok) processed += 1
      else errors.push(`${row.id}: ${result.error}`)
    } catch (e) {
      errors.push(`${row.id}: ${e?.message || e}`)
    }
  }

  return { processed, errors }
}

/**
 * @param {import('next/server').NextResponse} res
 */
export function attachErasureSessionClear(res) {
  clearGostayloSessionCookie(res)
  return res
}
