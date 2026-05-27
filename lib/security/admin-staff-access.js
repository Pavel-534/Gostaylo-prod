/**
 * Stage 90.1 / 118.6 — единая роль-матрица для **`/api/admin/**`** и **`/api/v2/admin/**`** (staff + RBAC + request cache).
 */
import { NextResponse } from 'next/server'
import { requireAccess } from '@/lib/security/access-guard'
import { AuthErrorCode } from '@/lib/auth/auth-error-codes'
import { normalizeAdminRole } from '@/lib/admin/admin-menu'
import { getAllowedRolesForAdminApiPath } from '@/lib/admin/admin-api-access'
import {
  getRequestAccessStore,
  runWithRequestAccessCache,
} from '@/lib/security/request-access-cache'

export const ADMIN_STAFF_ROLES = ['ADMIN', 'MODERATOR']

function denyForbidden() {
  return NextResponse.json({ success: false, error_code: AuthErrorCode.AUTH_ACCESS_FORBIDDEN }, { status: 403 })
}

function pathnameFromRequest(request) {
  if (!request?.url) return null
  try {
    return new URL(request.url).pathname
  } catch {
    return null
  }
}

/**
 * @param {import('next/server').NextRequest | Request | undefined} request
 * @returns {Awaited<ReturnType<typeof requireAccess>>}
 */
export async function requireAdminStaff(request) {
  const check = async () => {
    const gate = await requireAccess({ roles: ADMIN_STAFF_ROLES })
    if (gate.error) return gate

    const apiPath = pathnameFromRequest(request)
    if (!apiPath) return gate

    const role = normalizeAdminRole(gate.profile?.role)
    const allowed = getAllowedRolesForAdminApiPath(apiPath)
    if (role && allowed.length && !allowed.includes(role)) {
      return { error: denyForbidden() }
    }

    return gate
  }

  if (!getRequestAccessStore()) {
    return runWithRequestAccessCache(check)
  }

  return check()
}
