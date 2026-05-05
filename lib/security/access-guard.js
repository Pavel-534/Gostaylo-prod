import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'
import { supabaseAdmin } from '@/lib/supabase'
import { clearGostayloSessionCookie } from '@/lib/auth/app-session-issue'

function deny(status, error, clearSession = false) {
  const res = NextResponse.json({ success: false, error }, { status })
  if (clearSession) clearGostayloSessionCookie(res)
  return res
}

/**
 * Centralized server guard: fresh role/banned check from DB.
 * @param {{ roles?: string[] }} [opts]
 */
export async function requireAccess(opts = {}) {
  const roles = Array.isArray(opts.roles) ? opts.roles.map((r) => String(r).toUpperCase()) : null
  const session = await getSessionPayload()
  if (!session?.userId) return { error: deny(401, 'Unauthorized') }
  if (!supabaseAdmin) return { error: deny(500, 'Server database client unavailable') }

  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('id,email,role,is_banned')
    .eq('id', session.userId)
    .maybeSingle()

  if (error || !profile) return { error: deny(401, 'Unauthorized', true) }
  if (profile.is_banned === true) return { error: deny(403, 'Account suspended', true) }

  const role = String(profile.role || '').toUpperCase()
  if (roles && roles.length && !roles.includes(role)) {
    return { error: deny(403, 'Forbidden') }
  }

  return { profile: { ...profile, role } }
}

