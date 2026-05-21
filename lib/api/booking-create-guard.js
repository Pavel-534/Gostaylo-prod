/**
 * Stage 111.1b — SSOT session scope for POST /api/v2/bookings (IDOR fix).
 * `renterId` в теле игнорируется для гостя; только staff может указать чужой renterId.
 */

import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/api/api-guard'
import { AuthErrorCode } from '@/lib/auth/auth-error-codes'

function fail(status, error_code, extra = {}) {
  return {
    ok: false,
    response: NextResponse.json({ success: false, error_code, ...extra }, { status }),
  }
}

/**
 * @param {object} [body] — parsed POST body (may include client renterId)
 * @returns {Promise<
 *   | { ok: false, response: import('next/server').NextResponse }
 *   | { ok: true, session: object, renterId: string, isStaff: boolean }
 * >}
 */
export async function resolveBookingCreateSession(body = {}) {
  const guard = await requireSession()
  if (!guard.ok) return guard

  const sessionUserId = String(guard.session.userId)
  const rawRenter = body?.renterId
  const bodyRenterId =
    rawRenter != null && String(rawRenter).trim() !== '' ? String(rawRenter).trim() : null

  if (guard.isStaff) {
    return {
      ok: true,
      session: guard.session,
      renterId: bodyRenterId || sessionUserId,
      isStaff: true,
    }
  }

  if (bodyRenterId && bodyRenterId !== sessionUserId) {
    return fail(403, AuthErrorCode.AUTH_ACCESS_FORBIDDEN)
  }

  return {
    ok: true,
    session: guard.session,
    renterId: sessionUserId,
    isStaff: false,
  }
}
