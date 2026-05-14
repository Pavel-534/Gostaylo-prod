/**
 * Доступ к API и разделам админки «Безопасность» (contact leak, blacklist API в перспективе).
 * Только роль ADMIN (MODERATOR с middleware не попадает на /admin/security).
 */

import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { tryGetJwtSecret } from '@/lib/auth/jwt-secret'
import { verifyAppSessionJwt } from '@/lib/auth/verify-app-session-jwt'

/**
 * @returns {Promise<{ profile: { id: string, email: string, role: string } } | { error: { message: string, status: number } }>}
 */
export async function resolveAdminSecurityProfile() {
  const jwtCheck = tryGetJwtSecret()
  if (!jwtCheck.ok) {
    return { error: { message: jwtCheck.error?.message || 'Server misconfigured', status: 500 } }
  }

  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('gostaylo_session')
  if (!sessionCookie?.value) {
    return { error: { message: 'Unauthorized', status: 401 } }
  }

  const v = verifyAppSessionJwt(sessionCookie.value, jwtCheck.secret)
  if (!v.ok || !v.payload?.userId) {
    return { error: { message: 'Invalid session', status: 401 } }
  }
  const userId = v.payload.userId

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
    .eq('id', userId)
    .single()

  if (error || !profile) {
    return { error: { message: 'Unauthorized', status: 401 } }
  }
  if (profile.is_banned === true) {
    return { error: { message: 'Forbidden', status: 403 } }
  }
  if (String(profile.role || '').toUpperCase() !== 'ADMIN') {
    return { error: { message: 'Forbidden', status: 403 } }
  }

  return { profile }
}
