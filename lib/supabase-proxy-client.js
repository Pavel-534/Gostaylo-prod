/**
 * Клиентские запросы к PostgREST через same-origin /_db (rewrites → Supabase).
 * Только anon key — не использовать service role.
 */

export function getSupabaseAnonHeaders(extra = {}) {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...extra,
  }
}

/** Путь вида "listings?status=eq.ACTIVE" или "profiles?id=eq.x" */
export function dbProxyUrl(pathAndQuery) {
  const trimmed = String(pathAndQuery).replace(/^\/+/, '')
  return `/_db/${trimmed}`
}
