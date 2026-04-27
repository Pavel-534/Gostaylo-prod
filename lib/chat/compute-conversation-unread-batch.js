/**
 * Подсчёт непрочитанных по списку бесед — та же логика, что enrich в GET /api/v2/chat/conversations.
 */

import { supabaseAdmin } from '@/lib/supabase'

/**
 * @param {string} viewerUserId
 * @param {Array<{ id: string, renter_id?: string|null, partner_id?: string|null, owner_id?: string|null }>} conversations
 * @returns {Promise<Record<string, number>>}
 */
export async function computeUnreadCountByConversationId(viewerUserId, conversations) {
  const out = {}
  if (!supabaseAdmin || !viewerUserId || !conversations?.length) return out

  const viewerUid = String(viewerUserId)
  const ids = [...new Set(conversations.map((c) => String(c.id)).filter(Boolean))]
  if (!ids.length) return out

  const convById = new Map(conversations.map((c) => [String(c.id), c]))

  const { data: msgRows, error } = await supabaseAdmin
    .from('messages')
    .select('conversation_id,sender_id,read_at_renter,read_at_partner,is_read')
    .in('conversation_id', ids)

  if (error || !Array.isArray(msgRows)) return out

  for (const m of msgRows) {
    const cid = String(m.conversation_id || '')
    if (!cid) continue
    const c = convById.get(cid)
    if (!c) continue
    if (String(m.sender_id || '') === viewerUid) continue

    const isRenter = String(c.renter_id) === viewerUid
    const isHostSide =
      String(c.renter_id) !== viewerUid &&
      (String(c.partner_id) === viewerUid || String(c.owner_id) === viewerUid)
    const unread = isRenter
      ? m.read_at_renter == null
      : isHostSide
        ? m.read_at_partner == null
        : m.is_read === false

    if (unread) out[cid] = (out[cid] || 0) + 1
  }

  return out
}
