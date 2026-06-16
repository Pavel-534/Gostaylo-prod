/**
 * Session Service - Server-side session validation
 *
 * Uses REST API for Supabase access.
 * SECURITY: Prefer getUserIdFromSession() — reads JWT cookie; cannot be spoofed by client.
 * JWT verify SSOT: `lib/auth/verify-app-session-jwt.js` (HS256, matches `app-session-issue.js`).
 */

import { getJwtSecret, tryGetJwtSecret } from '@/lib/auth/jwt-secret'
import { verifyAppSessionJwt } from '@/lib/auth/verify-app-session-jwt'
import { AuthErrorCode, authErrorJson } from '@/lib/auth/auth-error-codes'
import { getSmokeFinancialSessionUserId } from '@/lib/smoke/smoke-session-override.js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/** Explicit opt-in only; never implied by NODE_ENV alone (P0 auth hardening). */
function isPartnerDevStubExplicitlyEnabled() {
  return (
    process.env.ALLOW_PARTNER_DEV_STUB === 'true' && process.env.NODE_ENV === 'development'
  )
}

/**
 * Extract user ID from gostaylo_session cookie (JWT) — cannot be spoofed by client.
 */
export async function getUserIdFromSession() {
  const smokeUid = getSmokeFinancialSessionUserId()
  if (smokeUid) return smokeUid
  const payload = await getSessionPayload()
  return payload?.userId ?? null
}

/**
 * Full JWT payload (userId, role, email) for RBAC on the server.
 */
export async function getSessionPayload() {
  const smokeUid = getSmokeFinancialSessionUserId()
  if (smokeUid && process.env.SMOKE_FINANCIAL_RUN === '1') {
    try {
      const { supabaseAdmin } = await import('@/lib/supabase')
      if (supabaseAdmin) {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id, role, email')
          .eq('id', smokeUid)
          .maybeSingle()
        if (profile?.id) {
          return {
            userId: profile.id,
            authUserId: null,
            role: String(profile.role || 'RENTER').toUpperCase(),
            email: profile.email || null,
          }
        }
      }
    } catch {
      // fall through to cookie JWT
    }
  }

  try {
    const secret = getJwtSecret()
    const { cookies } = await import('next/headers')
    const cookieStore = cookies()
    const session = cookieStore.get('gostaylo_session')
    if (!session?.value) return null
    const v = verifyAppSessionJwt(session.value, secret)
    if (!v.ok) return null
    const decoded = v.payload
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
 * Partner API routes: valid JWT + DB role in { PARTNER, ADMIN, MODERATOR }.
 * @returns {{ userId: string, userRole: string } | { error: NextResponse }}
 */
export async function requirePartnerSession() {
  const jwtCheck = tryGetJwtSecret()
  if (!jwtCheck.ok) {
    return { error: authErrorJson(AuthErrorCode.AUTH_JWT_NOT_CONFIGURED, 500) }
  }
  const { cookies } = await import('next/headers')
  const cookieStore = cookies()
  const session = cookieStore.get('gostaylo_session')
  if (!session?.value) {
    return { error: authErrorJson(AuthErrorCode.AUTH_NOT_AUTHENTICATED, 401) }
  }
  const v = verifyAppSessionJwt(session.value, jwtCheck.secret)
  if (!v.ok) {
    return { error: authErrorJson(AuthErrorCode.AUTH_NOT_AUTHENTICATED, 401) }
  }
  const userId = v.payload?.userId
  if (!userId) {
    return { error: authErrorJson(AuthErrorCode.AUTH_NOT_AUTHENTICATED, 401) }
  }
  const partner = await verifyPartnerAccess(String(userId))
  if (!partner) {
    return { error: authErrorJson(AuthErrorCode.AUTH_ACCESS_FORBIDDEN, 403) }
  }
  return { userId: String(userId), userRole: partner.role }
}

/**
 * Verify user has partner-area access (DB role is source of truth for elevation after approval).
 * Without Supabase URL/key: deny unless **ALLOW_PARTNER_DEV_STUB=true** and **NODE_ENV=development** (explicit stub).
 * Production: stub **never** runs, even if the env flag is set.
 */
export async function verifyPartnerAccess(userId) {
  if (!userId) return null

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    if (isPartnerDevStubExplicitlyEnabled()) {
      console.warn(
        '\n[SESSION] ═══════════════════════════════════════════════════════════════',
        '\n[SESSION] DANGER: ALLOW_PARTNER_DEV_STUB=true — verifyPartnerAccess BYPASSES the database.',
        '\n[SESSION] Returning a synthetic PARTNER for local UX only. Never use on shared hosts or prod-like envs.',
        '\n[SESSION] ═══════════════════════════════════════════════════════════════\n',
        { userId },
      )
      return { id: userId, role: 'PARTNER' }
    }
    console.error(
      '[SESSION] No Supabase credentials — denying partner access (set ALLOW_PARTNER_DEV_STUB=true in development only if you intentionally need the stub)',
    )
    return null
  }

  try {
    const baseUrl = SUPABASE_URL.replace(/\/$/, '')
    const res = await fetch(
      `${baseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(String(userId))}&select=id,email,first_name,last_name,role`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        cache: 'no-store',
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
  requirePartnerSession,
}
