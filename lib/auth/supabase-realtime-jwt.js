/**
 * JWT для Supabase Realtime (postgres_changes с RLS по auth.uid()).
 * Подпись тем же секретом, что в Supabase Dashboard → Settings → API → JWT Secret.
 * Переменная окружения: SUPABASE_JWT_SECRET
 */

import jwt from 'jsonwebtoken'

/**
 * @param {string} userId — UUID профиля (совпадает с sub в политиках RLS).
 * @param {{ email?: string | null }} [opts]
 * @returns {string | null}
 */
export function createSupabaseRealtimeAccessToken(userId, opts = {}) {
  const secret = String(process.env.SUPABASE_JWT_SECRET || '').trim()
  if (!secret || !userId) return null

  const now = Math.floor(Date.now() / 1000)
  const email = opts.email ? String(opts.email).trim() : undefined

  return jwt.sign(
    {
      role: 'authenticated',
      aud: 'authenticated',
      sub: String(userId),
      ...(email ? { email } : {}),
      iat: now,
      exp: now + 3600,
    },
    secret,
    { algorithm: 'HS256' },
  )
}
