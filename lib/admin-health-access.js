import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { createClient } from '@supabase/supabase-js'
import { getJwtSecret } from '@/lib/auth/jwt-secret'

/** Comma-separated owner emails that may open the health dashboard without role ADMIN (still need staff session to reach /admin). */
export function parseAdminHealthAllowEmails() {
  return new Set(
    String(process.env.ADMIN_HEALTH_EMAILS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  )
}

/**
 * Health dashboard: role ADMIN in `profiles`, OR email listed in `ADMIN_HEALTH_EMAILS`.
 * Moderators and others are denied unless their email is explicitly allowlisted.
 */
export function canAccessAdminHealth(profile) {
  const role = String(profile?.role || '').toUpperCase()
  if (role === 'ADMIN') return true
  const email = String(profile?.email || '').trim().toLowerCase()
  const allow = parseAdminHealthAllowEmails()
  if (allow.size > 0 && email && allow.has(email)) return true
  return false
}

/**
 * @returns {Promise<{ profile: { id: string, email: string, role: string } } | { error: { message: string, status: number } }>}
 */
export async function resolveAdminHealthProfile() {
  let jwtSecret
  try {
    jwtSecret = getJwtSecret()
  } catch (e) {
    return { error: { message: e?.message || 'Server misconfigured', status: 500 } }
  }

  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('gostaylo_session')
  if (!sessionCookie?.value) {
    return { error: { message: 'Unauthorized', status: 401 } }
  }

  let decoded
  try {
    decoded = jwt.verify(sessionCookie.value, jwtSecret)
  } catch {
    return { error: { message: 'Invalid session', status: 401 } }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return { error: { message: 'Database not configured', status: 500 } }
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, email, role, is_banned')
    .eq('id', decoded.userId)
    .single()

  if (error || !profile) {
    return { error: { message: 'Unauthorized', status: 401 } }
  }
  if (profile.is_banned === true) {
    return { error: { message: 'Forbidden', status: 403 } }
  }
  if (!canAccessAdminHealth(profile)) {
    return { error: { message: 'Нет доступа к панели здоровья', status: 403 } }
  }

  return { profile }
}
