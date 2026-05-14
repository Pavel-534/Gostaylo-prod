import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'
import { supabaseAdmin } from '@/lib/supabase'
import { AuthErrorCode } from '@/lib/auth/auth-error-codes'

const STAFF_ROLES = new Set(['ADMIN', 'MODERATOR'])

function fail(status, error_code, extra = {}) {
  return {
    ok: false,
    response: NextResponse.json({ success: false, error_code, ...extra }, { status }),
  }
}

function normalizeRole(role) {
  return String(role || '').toUpperCase()
}

export async function requireSession() {
  const session = await getSessionPayload()
  if (!session?.userId) {
    return fail(401, AuthErrorCode.AUTH_NOT_AUTHENTICATED)
  }
  const role = normalizeRole(session.role)
  return {
    ok: true,
    session: { ...session, role },
    isStaff: STAFF_ROLES.has(role),
  }
}

/**
 * Validate session + booking ownership / role access.
 * allowedActors: ['renter', 'partner', 'staff']
 */
export async function validateAccess(request, bookingId, allowedActors = ['staff'], options = {}) {
  const guard = await requireSession()
  if (!guard.ok) return guard

  const role = guard.session.role
  const isStaff = guard.isStaff
  const allowed = new Set((allowedActors || []).map((x) => String(x || '').toLowerCase()))

  if (!bookingId) {
    return fail(400, AuthErrorCode.API_BOOKING_ID_REQUIRED)
  }

  const select =
    options.select ||
    'id,status,renter_id,partner_id,price_thb,commission_thb,partner_earnings_thb,metadata,checked_in_at'

  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .select(select)
    .eq('id', bookingId)
    .maybeSingle()

  if (error || !booking) {
    return fail(404, AuthErrorCode.API_BOOKING_NOT_FOUND)
  }

  if (allowed.has('staff') && isStaff) {
    return {
      ok: true,
      session: guard.session,
      role,
      isStaff,
      booking,
    }
  }

  const userId = String(guard.session.userId)
  const isRenter = String(booking.renter_id || '') === userId
  const isPartner = String(booking.partner_id || '') === userId

  if ((allowed.has('renter') && isRenter) || (allowed.has('partner') && isPartner)) {
    return {
      ok: true,
      session: guard.session,
      role,
      isStaff,
      booking,
    }
  }

  return fail(403, AuthErrorCode.AUTH_ACCESS_FORBIDDEN)
}

/**
 * Session + self-scope resolver for bookings list endpoint.
 */
export async function resolveBookingListScope(searchParams) {
  const guard = await requireSession()
  if (!guard.ok) return guard

  const role = guard.session.role
  const isStaff = guard.isStaff
  const isPartner = role === 'PARTNER'
  const userId = String(guard.session.userId)

  let renterId = searchParams.get('renterId')
  let partnerId = searchParams.get('partnerId')

  if (!isStaff) {
    if (renterId && renterId !== userId) return fail(403, AuthErrorCode.AUTH_ACCESS_FORBIDDEN)
    if (partnerId && partnerId !== userId) return fail(403, AuthErrorCode.AUTH_ACCESS_FORBIDDEN)
    if (!renterId && !partnerId) {
      if (isPartner) partnerId = userId
      else renterId = userId
    }
  }

  return {
    ok: true,
    session: guard.session,
    isStaff,
    filters: {
      renterId,
      partnerId,
      listingId: searchParams.get('listingId'),
      status: searchParams.get('status'),
      limit: parseInt(searchParams.get('limit')) || 50,
    },
  }
}
