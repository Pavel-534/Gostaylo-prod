/**
 * JWT для Supabase Realtime (postgres_changes с RLS по auth.uid()).
 * Подпись тем же секретом, что в Supabase Dashboard → Settings → API → JWT Secret.
 * Переменная окружения: SUPABASE_JWT_SECRET
 */

import jwt from 'jsonwebtoken'
import { v5 as uuidv5, validate as uuidValidate } from 'uuid'

const REALTIME_SUB_NAMESPACE = 'c5f28384-6ef5-4c79-b526-24f88b5f34a7'

function buildRealtimeSub(authUserId, profileId) {
  const authUid = String(authUserId || '').trim()
  if (uuidValidate(authUid)) return authUid

  const profile = String(profileId || '').trim()
  if (uuidValidate(profile)) return profile

  if (!profile) return null
  return uuidv5(profile, REALTIME_SUB_NAMESPACE)
}

/**
 * @param {{ profileId: string, authUserId?: string | null, email?: string | null }} params
 * @returns {string | null}
 */
export function createSupabaseRealtimeAccessToken(params) {
  const profileId = String(params?.profileId || '').trim()
  const authUserId = params?.authUserId ? String(params.authUserId).trim() : ''
  const email = params?.email ? String(params.email).trim() : undefined
  const secret = String(process.env.SUPABASE_JWT_SECRET || '').trim()
  if (!secret || !profileId) return null

  const now = Math.floor(Date.now() / 1000)
  const sub = buildRealtimeSub(authUserId, profileId)
  if (!sub) return null

  return jwt.sign(
    {
      role: 'authenticated',
      aud: 'authenticated',
      sub,
      profile_id: profileId,
      ...(email ? { email } : {}),
      iat: now,
      exp: now + 3600,
    },
    secret,
    { algorithm: 'HS256' },
  )
}
