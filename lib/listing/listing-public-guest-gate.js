/**
 * Stage 149.2 — OG Guest-Gate: public PDP/API access for non-ACTIVE listings.
 */

import { isStaffRole } from '@/lib/services/chat/access'

export const LISTING_GUEST_GATE_CODES = {
  UNDER_MODERATION: 'LISTING_UNDER_MODERATION',
  NOT_PUBLIC: 'LISTING_NOT_PUBLIC',
}

/**
 * @param {object} params
 * @param {object | null | undefined} params.listing
 * @param {string | null | undefined} [params.viewerId]
 * @param {string | null | undefined} [params.viewerRole]
 * @param {boolean} [params.isSocialCrawler]
 * @returns {{ allowed: true, reason?: string } | { allowed: false, code: string, httpStatus: number }}
 */
export function resolveListingPublicGuestAccess({
  listing,
  viewerId = null,
  viewerRole = null,
  isSocialCrawler = false,
}) {
  if (!listing || typeof listing !== 'object') {
    return {
      allowed: false,
      code: LISTING_GUEST_GATE_CODES.NOT_PUBLIC,
      httpStatus: 404,
    }
  }

  const status = String(listing.status || '').toUpperCase()
  const isDraft =
    listing.metadata &&
    typeof listing.metadata === 'object' &&
    listing.metadata.is_draft === true

  if (isDraft) {
    return {
      allowed: false,
      code: LISTING_GUEST_GATE_CODES.NOT_PUBLIC,
      httpStatus: 404,
    }
  }

  const viewer = viewerId ? String(viewerId) : ''
  const ownerId = listing.owner_id ? String(listing.owner_id) : ''
  const staff = isStaffRole(String(viewerRole || '').toUpperCase())

  if (staff || (viewer && ownerId && viewer === ownerId)) {
    return { allowed: true, reason: 'privileged_viewer' }
  }

  if (status === 'ACTIVE' && listing.available !== false) {
    return { allowed: true, reason: 'active' }
  }

  if (status === 'PENDING' && isSocialCrawler) {
    return { allowed: true, reason: 'og_crawler_preview' }
  }

  if (status === 'PENDING') {
    return {
      allowed: false,
      code: LISTING_GUEST_GATE_CODES.UNDER_MODERATION,
      httpStatus: 403,
    }
  }

  return {
    allowed: false,
    code: LISTING_GUEST_GATE_CODES.NOT_PUBLIC,
    httpStatus: 404,
  }
}
