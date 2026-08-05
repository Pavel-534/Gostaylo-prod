/**
 * Stage 200.42 — Actor gate for booking payment / promo routes.
 * When booking.renter_id is set: session must match renter (guest checkout).
 * When null (manual bookings): session required + staff OR listing partner-owner.
 */

import { NextResponse } from 'next/server'
import { getUserIdFromSession } from '@/lib/services/session-service'
import { requireAccess } from '@/lib/security/access-guard'
import { ADMIN_STAFF_ROLES } from '@/lib/security/admin-staff-access'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * @param {{
 *   booking: { renter_id?: string|null, partner_id?: string|null, listing_id?: string|null },
 *   loginMessage?: string,
 * }} opts
 * @returns {Promise<
 *   | { ok: true, sessionUserId: string|null }
 *   | { ok: false, response: NextResponse }
 * >}
 */
export async function assertBookingPaymentActorAccess({
  booking,
  loginMessage = 'Please log in to complete payment',
}) {
  const sessionUserId = await getUserIdFromSession()
  const renterId = booking?.renter_id ? String(booking.renter_id) : null

  if (renterId) {
    if (!sessionUserId) {
      return {
        ok: false,
        response: NextResponse.json({ success: false, error: loginMessage }, { status: 401 }),
      }
    }
    if (renterId !== String(sessionUserId)) {
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, error: 'Access denied. This is not your booking.' },
          { status: 403 },
        ),
      }
    }
    return { ok: true, sessionUserId }
  }

  // Null renter_id — never public (C2)
  if (!sessionUserId) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: loginMessage }, { status: 401 }),
    }
  }

  // Staff: DB role ADMIN|MODERATOR (not requireAdminStaff — that path-RBAC maps non-/admin to ADMIN-only)
  const staffGate = await requireAccess({ roles: [...ADMIN_STAFF_ROLES] })
  if (!staffGate.error) {
    return { ok: true, sessionUserId }
  }

  const uid = String(sessionUserId)
  if (booking?.partner_id && String(booking.partner_id) === uid) {
    return { ok: true, sessionUserId }
  }

  if (booking?.listing_id && supabaseAdmin) {
    const { data: listing } = await supabaseAdmin
      .from('listings')
      .select('owner_id')
      .eq('id', booking.listing_id)
      .maybeSingle()
    if (listing?.owner_id && String(listing.owner_id) === uid) {
      return { ok: true, sessionUserId }
    }
  }

  return {
    ok: false,
    response: NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 }),
  }
}
