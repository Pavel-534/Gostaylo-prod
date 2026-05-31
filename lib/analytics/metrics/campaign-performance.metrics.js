/**
 * Stage 124.11 — метрики кампаний для Referral ROI (read-only, SSOT math via reporting.service).
 */
import { supabaseAdmin } from '@/lib/supabase';
import { round2 } from '@/lib/services/marketing/referral-calculation.js';

/** @typedef {'organic' | 'paid' | 'host_activation' | 'other'} MarketingSourceChannel */

export const SOURCE_CHANNEL_LABELS = Object.freeze({
  organic: 'Органика',
  paid: 'Платный трафик',
  host_activation: 'Активация хостов',
  other: 'Прочее',
});

/**
 * @param {string | null | undefined} utmSource
 * @param {Record<string, unknown>} [metadata]
 * @returns {MarketingSourceChannel}
 */
export function normalizeMarketingSourceChannel(utmSource, metadata = {}) {
  const utm = String(utmSource || '').trim().toLowerCase();
  const refType = String(
    metadata?.referral_type || metadata?.bonus_kind || metadata?.referralType || '',
  ).toLowerCase();
  if (refType.includes('host_activation') || utm.includes('host')) return 'host_activation';
  if (!utm || utm === '(none)' || utm === 'organic' || utm === 'direct' || utm === '(relation)') {
    return 'organic';
  }
  if (/paid|cpc|ads|google|facebook|meta|yandex|instagram|tiktok|vk|mytarget/.test(utm)) {
    return 'paid';
  }
  return 'other';
}

/**
 * ROI = комиссия платформы / расход promo (бонусы). SSOT: reporting.service computeRoi.
 * @param {number} commissionThb
 * @param {number} spendThb
 */
export function computeCampaignRoiIndex(commissionThb, spendThb) {
  const spend = round2(spendThb);
  if (spend <= 0) return null;
  return round2(Number(commissionThb) / spend);
}

async function fetchBookingCommissionMap(bookingIds) {
  const map = new Map();
  const ids = [...new Set((bookingIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('id, commission_thb, price_thb, renter_id')
      .in('id', chunk);
    if (error) throw new Error(error.message || 'CAMPAIGN_BOOKINGS_READ_FAILED');
    for (const row of data || []) map.set(String(row.id), row);
  }
  return map;
}

function campaignSlugFromRow(row) {
  const meta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  return String(meta.campaign_slug || '').trim() || '(default)';
}

/**
 * @param {Array<Record<string, unknown>>} campaignRows
 * @param {{ earnedRows?: Array<Record<string, unknown>>, clawbackRows?: Array<Record<string, unknown>> }} ledger
 */
export async function enrichCampaignPerformanceRows(campaignRows, ledger = {}) {
  const earnedRows = ledger.earnedRows || [];
  const clawbackRows = ledger.clawbackRows || [];

  const bookingIds = new Set();
  const spendBySlug = new Map();
  const clawbackBySlug = new Map();
  const bookingsBySlug = new Map();

  for (const row of earnedRows) {
    const slug = campaignSlugFromRow(row);
    spendBySlug.set(slug, round2((spendBySlug.get(slug) || 0) + (Number(row.amount_thb) || 0)));
    const bid = row.booking_id ? String(row.booking_id) : '';
    if (bid) {
      bookingIds.add(bid);
      if (!bookingsBySlug.has(slug)) bookingsBySlug.set(slug, new Set());
      bookingsBySlug.get(slug).add(bid);
    }
  }
  for (const row of clawbackRows) {
    const slug = campaignSlugFromRow(row);
    clawbackBySlug.set(
      slug,
      round2((clawbackBySlug.get(slug) || 0) + (Number(row.amount_thb) || 0)),
    );
  }

  const bookingMap = bookingIds.size ? await fetchBookingCommissionMap([...bookingIds]) : new Map();

  return (campaignRows || []).map((row) => {
    const slug = String(row.campaignSlug || '(default)');
    const spendThb = round2(row.spendThb ?? spendBySlug.get(slug) ?? row.earnedThb ?? 0);
    const clawbackThb = round2(clawbackBySlug.get(slug) || 0);
    let commissionThb = 0;
    const bids = bookingsBySlug.get(slug) || new Set();
    for (const bid of bids) {
      commissionThb += Number(bookingMap.get(bid)?.commission_thb) || 0;
    }
    commissionThb = round2(commissionThb);
    const grossMarginThb = round2(commissionThb - spendThb);
    const netEffectThb = round2(grossMarginThb - clawbackThb);
    const roiIndex = computeCampaignRoiIndex(commissionThb, spendThb);
    const guestsCount = Number(row.firstBookingsCount) || Number(row.signupsCount) || 0;
    const ltvThb = guestsCount > 0 ? round2(commissionThb / guestsCount) : null;

    return {
      ...row,
      spendThb,
      commissionThb,
      clawbackThb,
      grossMarginThb,
      netEffectThb,
      roiIndex,
      roiPct: roiIndex != null ? round2(roiIndex * 100) : null,
      ltvThb,
      promoTankSharePct: null,
    };
  });
}

/**
 * @param {Array<{ utmSource?: string, clicks?: number, signups?: number, firstBookings?: number }>} byUtmRows
 * @param {Array<Record<string, unknown>>} earnedRows
 */
export async function buildSourceChannelBreakdown(byUtmRows, earnedRows = []) {
  const channels = new Map(
    Object.keys(SOURCE_CHANNEL_LABELS).map((id) => [
      id,
      {
        id,
        label: SOURCE_CHANNEL_LABELS[id],
        clicks: 0,
        signups: 0,
        firstBookings: 0,
        spendThb: 0,
        commissionThb: 0,
        netEffectThb: 0,
        roiIndex: null,
      },
    ]),
  );

  for (const row of byUtmRows || []) {
    const ch = normalizeMarketingSourceChannel(row.utmSource);
    const agg = channels.get(ch);
    if (!agg) continue;
    agg.clicks += Number(row.clicks) || 0;
    agg.signups += Number(row.signups) || 0;
    agg.firstBookings += Number(row.firstBookings) || 0;
  }

  const bookingIds = [];
  const spendByChannel = new Map();
  for (const row of earnedRows) {
    const meta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    const ch = normalizeMarketingSourceChannel(meta.utm_source, meta);
    const agg = channels.get(ch);
    if (!agg) continue;
    const amt = round2(Number(row.amount_thb) || 0);
    agg.spendThb = round2(agg.spendThb + amt);
    spendByChannel.set(ch, round2((spendByChannel.get(ch) || 0) + amt));
    if (row.booking_id) bookingIds.push(String(row.booking_id));
  }

  const bookingMap = bookingIds.length ? await fetchBookingCommissionMap(bookingIds) : new Map();
  for (const row of earnedRows) {
    const meta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    const ch = normalizeMarketingSourceChannel(meta.utm_source, meta);
    const agg = channels.get(ch);
    const bid = row.booking_id ? String(row.booking_id) : '';
    if (!agg || !bid) continue;
    agg.commissionThb = round2(
      agg.commissionThb + (Number(bookingMap.get(bid)?.commission_thb) || 0),
    );
  }

  return [...channels.values()]
    .map((row) => {
      const netEffectThb = round2(row.commissionThb - row.spendThb);
      return {
        ...row,
        netEffectThb,
        roiIndex: computeCampaignRoiIndex(row.commissionThb, row.spendThb),
      };
    })
    .filter((row) => row.clicks > 0 || row.spendThb > 0 || row.commissionThb > 0)
    .sort((a, b) => (b.roiIndex ?? -1) - (a.roiIndex ?? -1));
}

/**
 * @param {Array<{ date: string, earnedThb?: number }>} chartDaily
 * @param {Array<Record<string, unknown>>} earnedRows
 */
export async function buildRoiDailySeries(chartDaily, earnedRows = []) {
  const commissionByDay = new Map();
  const spendByDay = new Map();
  const bookingIds = [];

  for (const row of earnedRows) {
    const dk = String(row.earned_at || row.created_at || '').slice(0, 10);
    if (!dk) continue;
    const amt = round2(Number(row.amount_thb) || 0);
    spendByDay.set(dk, round2((spendByDay.get(dk) || 0) + amt));
    if (row.booking_id) bookingIds.push(String(row.booking_id));
  }

  const bookingMap = bookingIds.length ? await fetchBookingCommissionMap(bookingIds) : new Map();
  for (const row of earnedRows) {
    const dk = String(row.earned_at || row.created_at || '').slice(0, 10);
    const bid = row.booking_id ? String(row.booking_id) : '';
    if (!dk || !bid) continue;
    commissionByDay.set(
      dk,
      round2((commissionByDay.get(dk) || 0) + (Number(bookingMap.get(bid)?.commission_thb) || 0)),
    );
  }

  return (chartDaily || []).map((day) => {
    const date = day.date;
    const spendThb = round2(spendByDay.get(date) ?? day.earnedThb ?? 0);
    const commissionThb = round2(commissionByDay.get(date) || 0);
    const netEffectThb = round2(commissionThb - spendThb);
    const roiIndex = computeCampaignRoiIndex(commissionThb, spendThb);
    return {
      date,
      label: String(date || '').slice(8, 10) + '.' + String(date || '').slice(5, 7),
      spendThb,
      commissionThb,
      netEffectThb,
      roiIndex,
      earnedThb: spendThb,
    };
  });
}
