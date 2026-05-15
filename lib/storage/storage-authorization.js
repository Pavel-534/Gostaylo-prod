/**
 * Server-side authorization for storage object paths (Stage 95.0).
 * Complements storage.objects RLS; upload API uses service_role but must still enforce ownership.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { LEGACY_AVATAR_PREFIX, STORAGE_BUCKETS } from '@/lib/storage/storage-buckets'

function normalizePath(raw) {
  return String(raw || '')
    .replace(/^\/+/, '')
    .replace(/\.\./g, '')
    .trim()
}

function firstSegment(path) {
  const p = normalizePath(path)
  return p ? p.split('/')[0] : ''
}

function secondSegment(path) {
  const p = normalizePath(path)
  const parts = p.split('/')
  return parts.length > 1 ? parts[1] : ''
}

/**
 * Resolve final object key from form fields.
 */
export function resolveStorageObjectPath({ objectPath, folder, userId }) {
  if (objectPath && typeof objectPath === 'string') {
    return normalizePath(objectPath)
  }
  const folderNorm = normalizePath(folder || userId || '')
  return folderNorm
}

/**
 * @param {{ bucket: string, objectPath: string, userId: string, role?: string }} params
 */
export async function assertStorageUploadAllowed({ bucket, objectPath, userId, role }) {
  const path = normalizePath(objectPath)
  const uid = String(userId || '').trim()
  if (!uid || !path) {
    return { ok: false, status: 400, error: 'Invalid upload path' }
  }

  const isAdmin = String(role || '').toUpperCase() === 'ADMIN'
  const isStaff = isAdmin || String(role || '').toUpperCase() === 'MODERATOR'

  switch (bucket) {
    case STORAGE_BUCKETS.AVATARS: {
      const owner = firstSegment(path)
      if (owner !== uid && !isAdmin) {
        return { ok: false, status: 403, error: 'Avatar path must start with your profile id' }
      }
      return { ok: true }
    }

    case STORAGE_BUCKETS.LISTING_IMAGES:
    case STORAGE_BUCKETS.LISTINGS_LEGACY: {
      if (path.startsWith(`${LEGACY_AVATAR_PREFIX}`)) {
        const avatarOwner = secondSegment(path)
        if (avatarOwner !== uid && !isAdmin) {
          return { ok: false, status: 403, error: 'Not allowed to write this avatar path' }
        }
        return { ok: true }
      }
      const listingId = firstSegment(path)
      if (!listingId) {
        return { ok: false, status: 400, error: 'Listing id required in path' }
      }
      if (!supabaseAdmin) {
        return { ok: false, status: 500, error: 'Database not configured' }
      }
      const { data: listing, error } = await supabaseAdmin
        .from('listings')
        .select('owner_id')
        .eq('id', listingId)
        .maybeSingle()
      if (error || !listing) {
        const hint =
          listingId.startsWith('wizard-')
            ? 'Listing not found (wizard temp id — save draft or re-upload after listing is created)'
            : 'Listing not found'
        return { ok: false, status: 404, error: hint, listingId }
      }
      if (listing.owner_id !== uid && !isAdmin) {
        return { ok: false, status: 403, error: 'Not the listing owner' }
      }
      return { ok: true }
    }

    case STORAGE_BUCKETS.VERIFICATION_DOCUMENTS: {
      const owner = firstSegment(path)
      if (owner !== uid && !isStaff) {
        return { ok: false, status: 403, error: 'Not allowed to upload verification documents here' }
      }
      return { ok: true }
    }

    case STORAGE_BUCKETS.CHAT_ATTACHMENTS: {
      const owner = firstSegment(path)
      if (owner !== uid && !isAdmin) {
        return { ok: false, status: 403, error: 'Chat uploads must be under your profile folder' }
      }
      return { ok: true }
    }

    case STORAGE_BUCKETS.REVIEW_IMAGES: {
      const owner = firstSegment(path)
      if (owner !== uid && !isAdmin) {
        return { ok: false, status: 403, error: 'Review photos must be under your user folder' }
      }
      return { ok: true }
    }

    case STORAGE_BUCKETS.DISPUTE_EVIDENCE: {
      const m = path.match(/^booking-([^/]+)\//)
      const bookingId = m?.[1]
      if (!bookingId) {
        return { ok: false, status: 400, error: 'Dispute path must be booking-{id}/…' }
      }
      if (!supabaseAdmin) {
        return { ok: false, status: 500, error: 'Database not configured' }
      }
      const { data: booking, error } = await supabaseAdmin
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .maybeSingle()
      if (error || !booking) {
        return { ok: false, status: 404, error: 'Booking not found' }
      }
      const guestId = booking.renter_id ?? booking.user_id ?? booking.guest_id ?? null
      const party = guestId === uid || booking.partner_id === uid || isStaff
      if (!party) {
        return { ok: false, status: 403, error: 'Not a party on this booking' }
      }
      return { ok: true }
    }

    default:
      return { ok: false, status: 400, error: 'Bucket not allowed' }
  }
}

/**
 * @param {{ bucket: string, objectPath: string, userId: string, role?: string }} params
 */
export async function assertStorageDeleteAllowed(params) {
  return assertStorageUploadAllowed(params)
}
