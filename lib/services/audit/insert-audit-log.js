/**
 * Запись в audit_logs через service role (сервер только).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const hdr = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=minimal',
}

/**
 * @param {object} p
 * @param {string} [p.userId]
 * @param {string} p.action
 * @param {string} p.entityType
 * @param {string} p.entityId
 * @param {object} [p.payload]
 */
export async function insertAuditLog({ userId, action, entityType, entityId, payload }) {
  if (!SUPABASE_URL || !SERVICE_KEY) return
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/audit_logs`, {
      method: 'POST',
      headers: hdr,
      body: JSON.stringify({
        user_id: userId ?? null,
        action,
        entity_type: entityType,
        entity_id: entityId,
        payload: payload ?? null,
      }),
    })
  } catch (e) {
    console.error('[audit_logs]', e?.message || e)
  }
}
