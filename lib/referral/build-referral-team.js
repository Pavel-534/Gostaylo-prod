/**
 * SSOT для списка прямых приглашённых (referral_relations.referrer_id = current).
 * Используется GET /api/v2/referral/me.
 */

import { formatPrivacyDisplayNameForParticipant } from '@/lib/utils/name-formatter';
import { computeUnreadCountByConversationId } from '@/lib/chat/compute-conversation-unread-batch';
import { REFERRAL_RENTER_IN_FLIGHT_BOOKING_STATUSES } from '@/lib/booking/status-sets.js';

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {string} referrerId
 * @returns {Promise<Array<{
 *   refereeId: string,
 *   displayName: string,
 *   role: string,
 *   invitedAt: string | null,
 *   activityStatus: 'active' | 'pending_first_booking',
 *   timelineStage: 'registered' | 'first_booking_pending' | 'completed_bonus_paid',
 *   conversationId: string | null,
 *   chatUnreadCount: number,
 * }>>}
 */
/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {string} referrerId
 * @param {{ limit?: number, offset?: number }} [opts]
 */
export async function buildReferralTeamMembers(supabaseAdmin, referrerId, opts = {}) {
  if (!supabaseAdmin || !referrerId) return [];

  const limit = Math.min(200, Math.max(1, Number(opts.limit) || 80));
  const offset = Math.max(0, Number(opts.offset) || 0);

  const { data: relations, error: relErr } = await supabaseAdmin
    .from('referral_relations')
    .select('referee_id, referred_at')
    .eq('referrer_id', referrerId)
    .order('referred_at', { ascending: false })
    .range(offset, offset + limit - 1);

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

  const [guestDone, hostDone, guestInFlight] = await Promise.all([
    supabaseAdmin.from('bookings').select('renter_id').eq('status', 'COMPLETED').in('renter_id', refereeIdsOrdered),
    supabaseAdmin.from('bookings').select('partner_id').eq('status', 'COMPLETED').in('partner_id', refereeIdsOrdered),
    supabaseAdmin
      .from('bookings')
      .select('renter_id,status')
      .in('renter_id', refereeIdsOrdered)
      .in('status', REFERRAL_RENTER_IN_FLIGHT_BOOKING_STATUSES),
  ]);

  const activeIds = new Set();
  for (const row of guestDone.data || []) activeIds.add(String(row.renter_id));
  for (const row of hostDone.data || []) activeIds.add(String(row.partner_id));

  const inFlightRenterIds = new Set();
  for (const row of guestInFlight.data || []) {
    const rid = String(row.renter_id || '').trim();
    if (rid) inFlightRenterIds.add(rid);
  }

  const earnedQ = supabaseAdmin
    .from('referral_ledger')
    .select('referee_id')
    .eq('referrer_id', referrerId)
    .eq('type', 'bonus')
    .eq('status', 'earned')
    .eq('referral_type', 'guest_booking')
    .in('referee_id', refereeIdsOrdered);
  const { data: earnedBonusRows, error: earnedErr } = await earnedQ;
  const earnedBonusRefereeIds = new Set();
  if (!earnedErr && earnedBonusRows?.length) {
    for (const row of earnedBonusRows) {
      const rid = String(row.referee_id || '').trim();
      if (rid) earnedBonusRefereeIds.add(rid);
    }
  } else if (earnedErr) {
    const { data: fallbackRows } = await supabaseAdmin
      .from('referral_ledger')
      .select('referee_id')
      .eq('referrer_id', referrerId)
      .eq('type', 'bonus')
      .eq('status', 'earned')
      .in('referee_id', refereeIdsOrdered);
    for (const row of fallbackRows || []) {
      const rid = String(row.referee_id || '').trim();
      if (rid) earnedBonusRefereeIds.add(rid);
    }
  }

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
    const inFlight = inFlightRenterIds.has(rid);
    const bonusPaid = earnedBonusRefereeIds.has(rid);
    let timelineStage = 'registered';
    if (bonusPaid || active) {
      timelineStage = 'completed_bonus_paid';
    } else if (inFlight) {
      timelineStage = 'first_booking_pending';
    }
    const conv = convByPeer.get(rid);
    return {
      refereeId: rid,
      displayName,
      role,
      invitedAt: referredAtByReferee[rid] || null,
      activityStatus: active ? 'active' : 'pending_first_booking',
      timelineStage,
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
