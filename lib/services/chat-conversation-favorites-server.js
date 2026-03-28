/**
 * Серверная логика избранных диалогов: проверка доступа к беседе (Supabase REST + service role).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export const supabaseServiceHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
}

export const supabaseServiceWriteHeaders = {
  ...supabaseServiceHeaders,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
}

export function supabaseConfigured() {
  return Boolean(SUPABASE_URL && SERVICE_KEY)
}

/**
 * @param {string} conversationId
 * @returns {Promise<object|null>}
 */
export async function fetchConversationRowForFavoriteCheck(conversationId) {
  if (!SUPABASE_URL || !conversationId) return null
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/conversations?id=eq.${encodeURIComponent(conversationId)}` +
      '&select=id,partner_id,renter_id,owner_id,admin_id&limit=1',
    { headers: supabaseServiceHeaders, cache: 'no-store' },
  )
  const rows = await res.json()
  return Array.isArray(rows) && rows[0] ? rows[0] : null
}

/**
 * Пользователь может помечать избранным только беседы, где он участник (или staff с доступом к существующей беседе).
 *
 * @param {object|null} row
 * @param {string} userId
 * @param {boolean} isStaff
 */
export function userMayFavoriteConversation(row, userId, isStaff) {
  if (!row || !userId) return false
  if (isStaff) return true
  const u = String(userId)
  return [row.partner_id, row.renter_id, row.owner_id, row.admin_id]
    .filter((x) => x != null && x !== '')
    .some((x) => String(x) === u)
}
