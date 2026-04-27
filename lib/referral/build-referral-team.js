/**
 * SSOT для списка прямых приглашённых (referral_relations.referrer_id = current).
 * Используется GET /api/v2/referral/me.
 */

import { formatPrivacyDisplayNameForParticipant } from '@/lib/utils/name-formatter';
import { computeUnreadCountByConversationId } from '@/lib/chat/compute-conversation-unread-batch';

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {string} referrerId
 * @returns {Promise<Array<{
 *   refereeId: string,
 *   displayName: string,
 *   role: string,
 *   invitedAt: string | null,
 *   activityStatus: 'active' | 'pending_first_booking',
 *   conversationId: string | null,
 *   chatUnreadCount: number,
 * }>>}
 */
export async function buildReferralTeamMembers(supabaseAdmin, referrerId) {
  if (!supabaseAdmin || !referrerId) return [];

  const { data: relations, error: relErr } = await supabaseAdmin
    .from('referral_relations')
    .select('referee_id, referred_at')
    .eq('referrer_id', referrerId)
    .order('referred_at', { ascending: false });

  if (relErr || !relations?.length) return [];

  /** Уникальные referee по порядку последнего приглашения */
  const refereeIdsOrdered = [];
  const seen = new Set();
  for (const r of relations) {
    const id = String(r.referee_id || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    refereeIdsOrdered.push(id);
  }
  if (!refereeIdsOrdered.length) return [];

  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, email, role')
    .in('id', refereeIdsOrdered);

  const profileById = Object.fromEntries((profiles || []).map((p) => [String(p.id), p]));

  const [guestDone, hostDone] = await Promise.all([
    supabaseAdmin.from('bookings').select('renter_id').eq('status', 'COMPLETED').in('renter_id', refereeIdsOrdered),
    supabaseAdmin.from('bookings').select('partner_id').eq('status', 'COMPLETED').in('partner_id', refereeIdsOrdered),
  ]);

  const activeIds = new Set();
  for (const row of guestDone.data || []) activeIds.add(String(row.renter_id));
  for (const row of hostDone.data || []) activeIds.add(String(row.partner_id));

  const [asRenterConvs, asPartnerConvs] = await Promise.all([
    supabaseAdmin
      .from('conversations')
      .select('id, partner_id, last_message_at')
      .eq('renter_id', referrerId)
      .in('partner_id', refereeIdsOrdered),
    supabaseAdmin
      .from('conversations')
      .select('id, renter_id, last_message_at')
      .eq('partner_id', referrerId)
      .in('renter_id', refereeIdsOrdered),
  ]);

  const convByPeer = new Map();
  function pickConv(peerId, convId, tsIso) {
    const key = String(peerId);
    const t = tsIso ? Date.parse(tsIso) : 0;
    const cur = convByPeer.get(key);
    const safeT = Number.isFinite(t) ? t : 0;
    if (!cur || safeT >= cur.ts) convByPeer.set(key, { conversationId: convId, ts: safeT });
  }
  for (const row of asRenterConvs.data || []) pickConv(row.partner_id, row.id, row.last_message_at);
  for (const row of asPartnerConvs.data || []) pickConv(row.renter_id, row.id, row.last_message_at);

  const referredAtByReferee = {};
  for (const r of relations) referredAtByReferee[String(r.referee_id)] = r.referred_at;

  const members = refereeIdsOrdered.map((rid) => {
    const p = profileById[rid];
    const displayName = formatPrivacyDisplayNameForParticipant(p?.first_name, p?.last_name, p?.email, 'Guest');
    const role = String(p?.role || 'RENTER').toUpperCase();
    const active = activeIds.has(rid);
    const conv = convByPeer.get(rid);
    return {
      refereeId: rid,
      displayName,
      role,
      invitedAt: referredAtByReferee[rid] || null,
      activityStatus: active ? 'active' : 'pending_first_booking',
      conversationId: conv?.conversationId ? String(conv.conversationId) : null,
    };
  });

  const convIds = [...new Set(members.map((m) => m.conversationId).filter(Boolean))];
  if (!convIds.length) {
    return members.map((m) => ({ ...m, chatUnreadCount: 0 }));
  }

  const { data: convRows } = await supabaseAdmin
    .from('conversations')
    .select('id, renter_id, partner_id, owner_id')
    .in('id', convIds);

  const unreadByCid = await computeUnreadCountByConversationId(referrerId, convRows || []);

  return members.map((m) => ({
    ...m,
    chatUnreadCount: m.conversationId ? unreadByCid[String(m.conversationId)] || 0 : 0,
  }));
}
