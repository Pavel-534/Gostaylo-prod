/**
 * Session Service - Server-side session validation
 *
 * Uses REST API for Supabase access.
 * SECURITY: Prefer getUserIdFromSession() — reads JWT cookie; cannot be spoofed by client.
 */

import { getJwtSecret } from '@/lib/auth/jwt-secret'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/**
 * Extract user ID from gostaylo_session cookie (JWT) — cannot be spoofed by client.
 */
export async function getUserIdFromSession() {
  const payload = await getSessionPayload()
  return payload?.userId ?? null
}

/**
 * Full JWT payload (userId, role, email) for RBAC on the server.
 */
export async function getSessionPayload() {
  try {
    const secret = getJwtSecret()
    const { cookies } = await import('next/headers')
    const cookieStore = cookies()
    const session = cookieStore.get('gostaylo_session')
    if (!session?.value) return null
    const jwt = (await import('jsonwebtoken')).default
    const decoded = jwt.verify(session.value, secret)
    const role = String(decoded?.role || '').toUpperCase()
    return {
      userId: decoded?.userId || null,
      authUserId: decoded?.authUserId || null,
      role,
      email: decoded?.email || null,
    }
  } catch {
    return null
  }
}

/**
 * Verify user has partner-area access (DB role is source of truth for elevation after approval).
 * Without Supabase URL/key: dev-only stub; production/staging always deny (no bypass).
 */
export async function verifyPartnerAccess(userId) {
  if (!userId) return null

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[SESSION] No Supabase — dev-only partner access stub for userId:', userId)
      return { id: userId, role: 'PARTNER' }
    }
    console.error(
      '[SESSION] No Supabase credentials — denying partner access (stub allowed only in NODE_ENV=development)',
    )
    return null
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=id,email,first_name,last_name,role`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    )

    const profiles = await res.json()

    if (!Array.isArray(profiles) || profiles.length === 0) {
      console.log('[SESSION] User not found:', userId)
      return null
    }

    const profile = profiles[0]
    const dbRole = String(profile.role || '').toUpperCase()

    const hasAccess = ['PARTNER', 'ADMIN', 'MODERATOR'].includes(dbRole)
    if (!hasAccess) {
      console.log('[SESSION] Access denied for role:', dbRole)
      return null
    }

    console.log(`[SESSION] Access granted: ${profile.email} (${dbRole})`)
    return { ...profile, role: dbRole }
  } catch (error) {
    console.error('[SESSION] Error:', error.message)
    return null
  }
}

export default {
  getUserIdFromSession,
  getSessionPayload,
  verifyPartnerAccess,
}
