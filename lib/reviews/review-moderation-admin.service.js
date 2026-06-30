/**
 * Stage 176.1 — staff review moderation (flagged queue + approve/remove).
 */

import { supabaseAdmin } from '@/lib/supabase'
import {
  REVIEW_MODERATION_APPROVED,
  REVIEW_MODERATION_FLAGGED,
  REVIEW_MODERATION_REMOVED,
} from '@/lib/reviews/moderation-status.js'
import { formatPrivacyDisplayName } from '@/lib/utils/name-formatter'

export const REVIEW_MODERATION_SOURCES = Object.freeze({
  LISTING: 'reviews',
  GUEST: 'guest_reviews',
})

/**
 * @param {unknown} source
 */
export function normalizeReviewModerationSource(source) {
  const s = String(source || '').trim()
  if (s === REVIEW_MODERATION_SOURCES.LISTING || s === 'listing') {
    return REVIEW_MODERATION_SOURCES.LISTING
  }
  if (s === REVIEW_MODERATION_SOURCES.GUEST || s === 'guest') {
    return REVIEW_MODERATION_SOURCES.GUEST
  }
  return null
}

function mapListingReviewRow(row) {
  const profile = row.profiles || {}
  const listing = row.listings || {}
  return {
    id: row.id,
    source: REVIEW_MODERATION_SOURCES.LISTING,
    sourceLabel: 'guest→listing',
    comment: row.comment || '',
    rating: row.rating,
    moderationStatus: row.moderation_status,
    authorId: row.user_id,
    authorName: formatPrivacyDisplayName(profile.first_name, profile.last_name),
    bookingId: row.booking_id,
    listingId: row.listing_id,
    listingTitle: listing.title || null,
    createdAt: row.created_at,
  }
}

/**
 * @param {{ limit?: number }} [opts]
 */
export async function listFlaggedReviewsForAdmin(opts = {}) {
  const limit = Math.min(200, Math.max(1, Number(opts.limit) || 100))
  if (!supabaseAdmin) return { items: [], errors: ['Supabase not configured'] }

  const half = limit

  const [listingRes, guestRes] = await Promise.all([
    supabaseAdmin
      .from('reviews')
      .select(
        `
        id,
        user_id,
        listing_id,
        booking_id,
        rating,
        comment,
        moderation_status,
        created_at,
        profiles:user_id (first_name, last_name),
        listings:listing_id (id, title)
      `,
      )
      .eq('moderation_status', REVIEW_MODERATION_FLAGGED)
      .order('created_at', { ascending: false })
      .limit(half),
    supabaseAdmin
      .from('guest_reviews')
      .select(
        `
        id,
        author_id,
        guest_id,
        booking_id,
        rating,
        comment,
        moderation_status,
        created_at,
        bookings:booking_id (
          id,
          listing_id,
          listings:listing_id (id, title)
        )
      `,
      )
      .eq('moderation_status', REVIEW_MODERATION_FLAGGED)
      .order('created_at', { ascending: false })
      .limit(half),
  ])

  const errors = []
  if (listingRes.error) errors.push(`reviews: ${listingRes.error.message}`)
  if (guestRes.error) errors.push(`guest_reviews: ${guestRes.error.message}`)

  const guestRows = guestRes.data || []
  const profileIds = [
    ...new Set(
      guestRows.flatMap((r) => [r.author_id, r.guest_id].filter(Boolean).map(String)),
    ),
  ]
  const profileMap = new Map()
  if (profileIds.length) {
    const { data: profiles, error: pErr } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', profileIds)
    if (pErr) errors.push(`profiles: ${pErr.message}`)
    for (const p of profiles || []) profileMap.set(String(p.id), p)
  }

  const items = [
    ...(listingRes.data || []).map(mapListingReviewRow),
    ...guestRows.map((row) => {
      const author = profileMap.get(String(row.author_id)) || {}
      const guest = profileMap.get(String(row.guest_id)) || {}
      const booking = row.bookings || {}
      const listing = booking.listings || null
      return {
        id: row.id,
        source: REVIEW_MODERATION_SOURCES.GUEST,
        sourceLabel: 'partner→guest',
        comment: row.comment || '',
        rating: row.rating,
        moderationStatus: row.moderation_status,
        authorId: row.author_id,
        authorName: formatPrivacyDisplayName(author.first_name, author.last_name),
        guestId: row.guest_id,
        guestName: formatPrivacyDisplayName(guest.first_name, guest.last_name),
        bookingId: row.booking_id,
        listingId: listing?.id || booking.listing_id || null,
        listingTitle: listing?.title || null,
        createdAt: row.created_at,
      }
    }),
  ].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))

  return { items: items.slice(0, limit), errors }
}

/**
 * @param {{ id: string, source: string, status: string, staffUserId?: string }} params
 */
export async function applyReviewModerationDecision(params) {
  const id = String(params.id || '').trim()
  const source = normalizeReviewModerationSource(params.source)
  const nextStatus = String(params.status || '').trim()

  if (!id || !source) {
    return { ok: false, error: 'Invalid review id or source', status: 400 }
  }
  if (nextStatus !== REVIEW_MODERATION_APPROVED && nextStatus !== REVIEW_MODERATION_REMOVED) {
    return { ok: false, error: 'status must be approved or removed', status: 400 }
  }

  const table = source
  const readSelect =
    source === REVIEW_MODERATION_SOURCES.LISTING
      ? 'id, moderation_status, listing_id'
      : 'id, moderation_status, booking_id'

  const { data: existing, error: readErr } = await supabaseAdmin
    .from(table)
    .select(readSelect)
    .eq('id', id)
    .maybeSingle()

  if (readErr) {
    return { ok: false, error: readErr.message, status: 500 }
  }
  if (!existing) {
    return { ok: false, error: 'Review not found', status: 404 }
  }

  const writeSelect =
    source === REVIEW_MODERATION_SOURCES.LISTING
      ? 'id, moderation_status, listing_id, booking_id'
      : 'id, moderation_status, booking_id'

  const { data: updated, error: upErr } = await supabaseAdmin
    .from(table)
    .update({
      moderation_status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(writeSelect)
    .single()

  if (upErr) {
    return { ok: false, error: upErr.message, status: 500 }
  }

  return {
    ok: true,
    data: {
      id: updated.id,
      source,
      moderationStatus: updated.moderation_status,
      listingId: updated.listing_id || null,
      bookingId: updated.booking_id || null,
    },
  }
}