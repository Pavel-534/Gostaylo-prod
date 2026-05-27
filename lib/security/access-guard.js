import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'
import { supabaseAdmin } from '@/lib/supabase'
import { clearGostayloSessionCookie } from '@/lib/auth/app-session-issue'
import { AuthErrorCode } from '@/lib/auth/auth-error-codes'
import { memoizeAccessCheck } from '@/lib/security/request-access-cache'

function deny(status, error_code, clearSession = false) {
  const res = NextResponse.json({ success: false, error_code }, { status })
  if (clearSession) clearGostayloSessionCookie(res)
  return res
}

/**
 * @param {{ roles?: string[] }} opts
 */
async function requireAccessUncached(opts = {}) {
  const roles = Array.isArray(opts.roles) ? opts.roles.map((r) => String(r).toUpperCase()) : null
  const session = await getSessionPayload()
  if (!session?.userId) return { error: deny(401, AuthErrorCode.AUTH_NOT_AUTHENTICATED) }
  if (!supabaseAdmin) return { error: deny(500, AuthErrorCode.AUTH_DATABASE_NOT_CONFIGURED) }

  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('id,email,role,is_banned')
    .eq('id', session.userId)
    .maybeSingle()

  if (error || !profile) return { error: deny(401, AuthErrorCode.AUTH_PROFILE_NOT_FOUND, true) }
  if (profile.is_banned === true) return { error: deny(403, AuthErrorCode.AUTH_ACCOUNT_SUSPENDED, true) }

  const role = String(profile.role || '').toUpperCase()
  if (roles && roles.length && !roles.includes(role)) {
    return { error: deny(403, AuthErrorCode.AUTH_ACCESS_FORBIDDEN) }
  }

  return { profile: { ...profile, role } }
}

/**
 * Centralized server guard: fresh role/banned check from DB (once per HTTP request when ALS active).
 * @param {{ roles?: string[] }} [opts]
 */
export async function requireAccess(opts = {}) {
  const roles = Array.isArray(opts.roles) ? opts.roles.map((r) => String(r).toUpperCase()) : []
  const cacheKey = roles.length ? `roles:${roles.sort().join(',')}` : 'roles:*'
  return memoizeAccessCheck(cacheKey, () => requireAccessUncached(opts))
}
