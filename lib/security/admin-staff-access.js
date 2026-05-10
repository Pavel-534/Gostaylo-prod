/**
 * Stage 90.1 — единая роль-матрица для **`/api/admin/**`** (staff без анонимного доступа).
 */
import { requireAccess } from '@/lib/security/access-guard'

export const ADMIN_STAFF_ROLES = ['ADMIN', 'MODERATOR']

/** @returns {Awaited<ReturnType<typeof requireAccess>>} */
export async function requireAdminStaff() {
  return requireAccess({ roles: ADMIN_STAFF_ROLES })
}
