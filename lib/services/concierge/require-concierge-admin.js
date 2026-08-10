/**
 * Shared admin Concierge route guard (ADMIN only).
 */

import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { AuthErrorCode } from '@/lib/auth/auth-error-codes'
import { normalizeAdminRole } from '@/lib/admin/admin-menu'

export async function requireConciergeAdmin(request) {
  const access = await requireAdminStaff(request)
  if (access.error) return { error: access.error, access: null }
  const role = normalizeAdminRole(access.profile?.role)
  if (role !== 'ADMIN') {
    return {
      error: NextResponse.json(
        { success: false, error_code: AuthErrorCode.AUTH_ACCESS_FORBIDDEN },
        { status: 403 },
      ),
      access: null,
    }
  }
  return { error: null, access }
}
