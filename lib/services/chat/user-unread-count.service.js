/**
 * Global chat unread badge — lightweight count SSOT (Stage 171.29).
 * Used by GET /api/v2/chat/unread-count and silent FCM badge sync after read.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { filterOutE2eConversationRows } from '@/lib/chat/filter-out-e2e-conversation-rows.js'
import { viewerConversationSide } from '@/lib/chat/read-receipts'

const CONVERSATION_IN_CHUNK = 100

/**
 * @param {string[]} conversationIds
 * @param {string} viewerUserId
 * @param {'renter' | 'partner' | 'legacy'} side
 */
async function countUnreadInConversations(conversationIds, viewerUserId, side) {
  if (!supabaseAdmin || !conversationIds.length) return 0

  const uid = String(viewerUserId)
  let total = 0

  for (let i = 0; i < conversationIds.length; i += CONVERSATION_IN_CHUNK) {
    const chunk = conversationIds.slice(i, i + CONVERSATION_IN_CHUNK)
    let query = supabaseAdmin
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .in('conversation_id', chunk)
      .neq('sender_id', uid)

    if (side === 'renter') {
      query = query.is('read_at_renter', null)
    } else if (side === 'partner') {
      query = query.is('read_at_partner', null)
    } else {
      query = query.eq('is_read', false)
    }

    const { count, error } = await query
    if (error) throw error
    total += Number(count) || 0
  }

  return total
}

/**
 * Includes archived threads (matches ChatContext `archived=all` badge semantics).
 *
 * @param {string} userId
 * @param {{ e2eBypass?: boolean }} [options]
 * @returns {Promise<{ count: number, lastUpdated: string }>}
 */
export async function getUserChatUnreadCount(userId, { e2eBypass = false } = {}) {
  const lastUpdated = new Date().toISOString()
  if (!supabaseAdmin || !userId) {
    return { count: 0, lastUpdated }
  }

  const uid = String(userId)
  const { data: rows, error } = await supabaseAdmin
    .from('conversations')
    .select('id,renter_id,partner_id,owner_id,listing_id,booking_id')
    .or(`partner_id.eq.${uid},renter_id.eq.${uid},owner_id.eq.${uid},admin_id.eq.${uid}`)

  if (error) throw error

  let conversations = Array.isArray(rows) ? rows : []
  if (!e2eBypass) {
    conversations = await filterOutE2eConversationRows(conversations)
  }

  const renterIds = []
  const partnerIds = []
  const legacyIds = []

  for (const c of conversations) {
    const cid = String(c.id || '')
    if (!cid) continue
    const side = viewerConversationSide(uid, c)
    if (side === 'renter') renterIds.push(cid)
    else if (side === 'partner') partnerIds.push(cid)
    else legacyIds.push(cid)
  }

  const [renterUnread, partnerUnread, legacyUnread] = await Promise.all([
    countUnreadInConversations(renterIds, uid, 'renter'),
    countUnreadInConversations(partnerIds, uid, 'partner'),
    countUnreadInConversations(legacyIds, uid, 'legacy'),
  ])

  return {
    count: renterUnread + partnerUnread + legacyUnread,
    lastUpdated,
  }
}
