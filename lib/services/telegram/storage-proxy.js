/**
 * Supabase public object URL → same-origin path /_storage/... (как lib/supabase-proxy-urls.js).
 * Храним относительный путь — работает на любом домене (.ru / .com).
 */

/**
 * @param {string} supabaseUrl - NEXT_PUBLIC_SUPABASE_URL
 * @param {string} publicObjectUrl - .../storage/v1/object/public/...
 * @returns {string}
 */
export function publicSupabaseUrlToProxyPath(supabaseUrl, publicObjectUrl) {
  if (!publicObjectUrl || !supabaseUrl) return publicObjectUrl
  const base = supabaseUrl.replace(/\/$/, '')
  const prefix = `${base}/storage/v1/object/public/`
  if (!publicObjectUrl.startsWith(prefix)) {
    return publicObjectUrl
  }
  const rest = publicObjectUrl.slice(prefix.length)
  return `/_storage/${rest}`
}
