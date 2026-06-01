/**
 * Stage 124.11–124.12 — метрики кампаний для Referral ROI (read-only, SSOT math via reporting.service).
 */
import { supabaseAdmin } from '@/lib/supabase';
import { round2 } from '@/lib/services/marketing/referral-calculation.js';
import {
  computeBudgetAlertLevel,
  computeBudgetUsagePct,
} from '@/lib/admin/referral-campaign-ui.js';
import { normalizeCampaignSlug } from '@/lib/services/marketing/referral-campaigns.service.js';

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

/**
 * CAC = расход promo / число первых броней (или регистраций как fallback).
 * @param {number} spendThb
 * @param {number} acquisitionsCount
 */
export function computeCacThb(spendThb, acquisitionsCount) {
  const count = Math.floor(Number(acquisitionsCount) || 0);
  const spend = round2(spendThb);
  if (count <= 0 || spend <= 0) return null;
  return round2(spend / count);
}

async function fetchBookingCommissionMap(bookingIds) {
  const map = new Map();
  const ids = [...new Set((bookingIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('id, commission_thb, price_thb, renter_id, status, created_at')
      .in('id', chunk);
    if (error) throw new Error(error.message || 'CAMPAIGN_BOOKINGS_READ_FAILED');
    for (const row of data || []) map.set(String(row.id), row);
  }
  return map;
}

export function campaignSlugFromLedgerRow(row) {
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
    const slug = campaignSlugFromLedgerRow(row);
    spendBySlug.set(slug, round2((spendBySlug.get(slug) || 0) + (Number(row.amount_thb) || 0)));
    const bid = row.booking_id ? String(row.booking_id) : '';
    if (bid) {
      bookingIds.add(bid);
      if (!bookingsBySlug.has(slug)) bookingsBySlug.set(slug, new Set());
      bookingsBySlug.get(slug).add(bid);
    }
  }
  for (const row of clawbackRows) {
    const slug = campaignSlugFromLedgerRow(row);
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
    const cacThb = computeCacThb(spendThb, row.firstBookingsCount || row.signupsCount);

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
      cacThb,
      guestsAcquired: guestsCount,
      promoTankSharePct: null,
    };
  });
}

/**
 * План vs факт бюджета кампании (lifetime spent из registry promo codes).
 * @param {Array<Record<string, unknown>>} campaignRows
 * @param {Array<Record<string, unknown>>} [campaignRegistry]
 */
export function enrichCampaignBudgetFields(campaignRows, campaignRegistry = []) {
  const bySlug = new Map(
    (campaignRegistry || []).map((c) => [normalizeCampaignSlug(c.slug) || c.slug, c]),
  );

  return (campaignRows || []).map((row) => {
    const slugRaw = String(row.campaignSlug || '(default)');
    const lookupSlug = slugRaw === '(default)' ? slugRaw : normalizeCampaignSlug(slugRaw);
    const reg = bySlug.get(lookupSlug);
    const maxBudgetThb = reg?.maxBudgetThb ?? null;
    const lifetimeSpentThb = round2(reg?.spentThb ?? 0);
    const remainingBudgetThb =
      reg?.remainingBudgetThb ??
      (maxBudgetThb != null ? round2(maxBudgetThb - lifetimeSpentThb) : null);
    const budgetUsagePct = computeBudgetUsagePct(maxBudgetThb, lifetimeSpentThb);
    const budgetAlertLevel = computeBudgetAlertLevel(maxBudgetThb, lifetimeSpentThb);

    return {
      ...row,
      maxBudgetThb,
      lifetimeSpentThb,
      remainingBudgetThb,
      budgetUsagePct,
      budgetAlertLevel,
      campaignName: reg?.name || slugRaw,
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
      const guestsAcquired = row.firstBookings;
      return {
        ...row,
        netEffectThb,
        roiIndex: computeCampaignRoiIndex(row.commissionThb, row.spendThb),
        cacThb: computeCacThb(row.spendThb, guestsAcquired),
        guestsAcquired,
      };
    })
    .filter((row) => row.clicks > 0 || row.spendThb > 0 || row.commissionThb > 0)
    .sort((a, b) => (b.roiIndex ?? -1) - (a.roiIndex ?? -1));
}

/**
 * @param {Record<string, unknown>} overall
 * @param {Array<Record<string, unknown>>} sourceBreakdown
 * @param {Record<string, unknown>} [funnelSummary]
 */
export function buildCacSummaryBlock(overall, sourceBreakdown, funnelSummary = {}) {
  const guestsAcquired =
    Number(funnelSummary.firstBookingUsersCount) ||
    Number(funnelSummary.firstBookings) ||
    0;
  const spendThb = round2(overall.earnedBonusesThb ?? overall.referralSpendThb ?? 0);
  const commissionThb = round2(overall.referredCommissionThb ?? 0);
  const cacThb = computeCacThb(spendThb, guestsAcquired);
  const roiIndex = overall.roiIndex ?? null;

  let ownerNote = 'За период нет первых броней — CAC появится после конверсий.';
  if (guestsAcquired > 0 && cacThb != null) {
    ownerNote =
      roiIndex != null && roiIndex >= 1
        ? `Средняя стоимость привлечения гостя — ฿${cacThb.toLocaleString('ru-RU')}; ROI ${Number(roiIndex).toFixed(2)} — программа окупается.`
        : `Средняя стоимость привлечения — ฿${cacThb.toLocaleString('ru-RU')}; ROI ниже 1 — расход на бонусы выше комиссии.`;
  } else if (spendThb > 0 && guestsAcquired === 0) {
    ownerNote = 'Есть расход promo, но нет первых броней — проверьте воронку атрибуции.';
  }

  return {
    overall: {
      cacThb,
      roiIndex,
      guestsAcquired,
      spendThb,
      commissionThb,
      ownerNote,
    },
    bySource: (sourceBreakdown || []).map((row) => ({
      id: row.id,
      label: row.label,
      cacThb: row.cacThb,
      roiIndex: row.roiIndex,
      guestsAcquired: row.guestsAcquired ?? row.firstBookings ?? 0,
      spendThb: row.spendThb,
      commissionThb: row.commissionThb,
    })),
  };
}

/**
 * @param {Array<Record<string, unknown>>} campaigns
 * @param {Record<string, unknown>} overall
 */
export function buildReferralBudgetAlerts(campaigns, overall) {
  /** @type {Array<{ level: 'critical'|'warning'|'info', type: string, message: string, campaignSlug?: string, href?: string }>} */
  const alerts = [];

  for (const c of campaigns || []) {
    if (!c.maxBudgetThb) continue;
    const slug = String(c.campaignSlug || '');
    if (c.budgetAlertLevel === 'critical') {
      alerts.push({
        level: 'critical',
        type: 'campaign_over_budget',
        campaignSlug: slug,
        message: `Перерасход по кампании «${c.campaignName || slug}»: ${c.budgetUsagePct ?? 100}% бюджета.`,
        href: `/admin/marketing/campaigns/${encodeURIComponent(slug === '(default)' ? '' : slug)}`,
      });
    } else if (c.budgetAlertLevel === 'warning') {
      alerts.push({
        level: 'warning',
        type: 'campaign_budget_warning',
        campaignSlug: slug,
        message: `Кампания «${c.campaignName || slug}» близка к лимиту бюджета (${c.budgetUsagePct ?? '≥90'}%).`,
        href: `/admin/marketing/campaigns/${encodeURIComponent(slug === '(default)' ? '' : slug)}`,
      });
    }
  }

  const balance = round2(overall.promoTankBalanceThb ?? 0);
  const periodSpend = round2(overall.earnedBonusesThb ?? 0);
  if (periodSpend > 0 && balance >= 0 && periodSpend >= balance * 0.5 && balance > 0) {
    alerts.push({
      level: 'warning',
      type: 'promo_tank_fast_burn',
      message: `Promo tank расходуется быстро: за период потрачено ฿${periodSpend.toLocaleString('ru-RU')} при остатке ฿${balance.toLocaleString('ru-RU')}.`,
      href: '/admin/marketing/budget',
    });
  }
  if (balance <= 0 && periodSpend > 0) {
    alerts.push({
      level: 'critical',
      type: 'promo_tank_empty',
      message: 'Promo tank пуст — новые бонусы требуют пополнения резерва.',
      href: '/admin/marketing/budget',
    });
  }

  const order = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => (order[a.level] ?? 9) - (order[b.level] ?? 9));
}

/**
 * @param {Array<Record<string, unknown>>} campaigns
 * @param {Record<string, unknown>} cacSummary
 * @param {Array<Record<string, unknown>>} budgetAlerts
 */
export function buildReferralFiHighlights(campaigns, cacSummary, budgetAlerts) {
  const withSpend = (campaigns || []).filter((c) => Number(c.spendThb) > 0);
  const byRoiDesc = [...withSpend].sort((a, b) => (b.roiIndex ?? -1) - (a.roiIndex ?? -1));
  const byRoiAsc = [...withSpend].sort((a, b) => (a.roiIndex ?? 999) - (b.roiIndex ?? 999));

  const pick = (row) =>
    row
      ? {
          campaignSlug: row.campaignSlug,
          campaignName: row.campaignName || row.campaignSlug,
          roiIndex: row.roiIndex,
          cacThb: row.cacThb,
          spendThb: row.spendThb,
          guestsAcquired: row.guestsAcquired ?? row.firstBookingsCount ?? 0,
        }
      : null;

  return {
    overallCacThb: cacSummary?.overall?.cacThb ?? null,
    totalSpendThb: cacSummary?.overall?.spendThb ?? 0,
    guestsAcquired: cacSummary?.overall?.guestsAcquired ?? 0,
    roiIndex: cacSummary?.overall?.roiIndex ?? null,
    topCampaign: pick(byRoiDesc[0]),
    worstCampaign:
      byRoiAsc[0] && byRoiAsc[0].campaignSlug !== byRoiDesc[0]?.campaignSlug
        ? pick(byRoiAsc[0])
        : pick(byRoiAsc[1]),
    topCampaigns: byRoiDesc.slice(0, 3).map(pick).filter(Boolean),
    worstCampaigns: byRoiAsc.slice(0, 3).map(pick).filter(Boolean),
    budgetAlerts: (budgetAlerts || []).slice(0, 3),
  };
}

/**
 * Топ / анти-топ кампаний для digest.
 * @param {Array<Record<string, unknown>>} campaigns
 * @param {number} [limit]
 */
export function pickCampaignRankings(campaigns, limit = 3) {
  const withSpend = (campaigns || []).filter((c) => Number(c.spendThb) > 0);
  const top = [...withSpend]
    .sort((a, b) => (b.roiIndex ?? -1) - (a.roiIndex ?? -1))
    .slice(0, limit)
    .map((row) => ({
      campaignSlug: row.campaignSlug,
      campaignName: row.campaignName || row.campaignSlug,
      roiIndex: row.roiIndex,
      cacThb: row.cacThb,
      spendThb: row.spendThb,
      netEffectThb: row.netEffectThb,
      guestsAcquired: row.guestsAcquired ?? row.firstBookingsCount ?? 0,
    }));
  const worst = [...withSpend]
    .sort((a, b) => (a.roiIndex ?? 999) - (b.roiIndex ?? 999))
    .slice(0, limit)
    .map((row) => ({
      campaignSlug: row.campaignSlug,
      campaignName: row.campaignName || row.campaignSlug,
      roiIndex: row.roiIndex,
      cacThb: row.cacThb,
      spendThb: row.spendThb,
      netEffectThb: row.netEffectThb,
      guestsAcquired: row.guestsAcquired ?? row.firstBookingsCount ?? 0,
    }));
  return { top, worst };
}

/**
 * Алерты для дашборда и digest: бюджет + ROI &lt; 1.
 * @param {{ overall?: Record<string, unknown>, campaigns?: Array<Record<string, unknown>>, budgetAlerts?: Array<Record<string, unknown>> }} ctx
 */
export function buildReferralRealtimeAlerts(ctx = {}) {
  /** @type {Array<{ level: string, type: string, message: string, href?: string, campaignSlug?: string }>} */
  const alerts = [...(ctx.budgetAlerts || [])];
  const roi = Number(ctx.overall?.roiIndex);
  const spend = round2(ctx.overall?.earnedBonusesThb ?? 0);

  if (Number.isFinite(roi) && roi > 0 && roi < 1 && spend > 0) {
    if (!alerts.some((a) => a.type === 'roi_below_one')) {
      alerts.push({
        level: 'critical',
        type: 'roi_below_one',
        message: `ROI программы ${roi.toFixed(2)} — ниже 1. Расход на бонусы выше комиссии за период.`,
        href: '/admin/marketing/roi',
      });
    }
  }

  const order = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => (order[a.level] ?? 9) - (order[b.level] ?? 9));
}

/**
 * @param {Array<{ date: string, earnedThb?: number }>} chartDaily
 * @param {Array<Record<string, unknown>>} earnedRows
 */
/**
 * ISO week key (Monday-based) for rollup labels.
 * @param {string} dateStr YYYY-MM-DD
 */
function isoWeekKey(dateStr) {
  const d = new Date(`${dateStr}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return dateStr;
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * Weekly rollup from daily ROI chart points (SSOT for dashboard toggle).
 * @param {Array<{ date: string, spendThb?: number, commissionThb?: number, roiIndex?: number | null }>} dailySeries
 */
export function buildRoiWeeklySeries(dailySeries = []) {
  const byWeek = new Map();
  for (const day of dailySeries || []) {
    const date = String(day.date || '');
    if (!date) continue;
    const wk = isoWeekKey(date);
    if (!byWeek.has(wk)) {
      byWeek.set(wk, {
        weekKey: wk,
        date: date,
        spendThb: 0,
        commissionThb: 0,
        days: 0,
      });
    }
    const agg = byWeek.get(wk);
    agg.spendThb = round2(agg.spendThb + (Number(day.spendThb) || 0));
    agg.commissionThb = round2(agg.commissionThb + (Number(day.commissionThb) || 0));
    agg.days += 1;
    if (date < agg.date) agg.date = date;
  }

  return [...byWeek.values()]
    .sort((a, b) => String(a.weekKey).localeCompare(String(b.weekKey)))
    .map((row) => {
      const netEffectThb = round2(row.commissionThb - row.spendThb);
      const roiIndex = computeCampaignRoiIndex(row.commissionThb, row.spendThb);
      const [y, w] = String(row.weekKey).split('-W');
      return {
        date: row.date,
        weekKey: row.weekKey,
        label: `Н${w}`,
        spendThb: row.spendThb,
        commissionThb: row.commissionThb,
        netEffectThb,
        roiIndex,
        earnedThb: row.spendThb,
      };
    });
}

/**
 * @param {Array<Record<string, unknown>>} earnedRows
 * @param {string} campaignSlug
 */
export async function buildCampaignRoiDailySeries(earnedRows, campaignSlug) {
  const slug = String(campaignSlug || '(default)');
  const filtered = (earnedRows || []).filter((r) => campaignSlugFromLedgerRow(r) === slug);
  const dates = [
    ...new Set(
      filtered.map((r) => String(r.earned_at || r.created_at || '').slice(0, 10)).filter(Boolean),
    ),
  ].sort();
  const chartDaily = dates.map((date) => ({ date, earnedThb: 0 }));
  return buildRoiDailySeries(chartDaily, filtered);
}

/**
 * @param {Array<Record<string, unknown>>} earnedRows
 * @param {Array<Record<string, unknown>>} clawbackRows
 * @param {string} campaignSlug
 */
export async function buildCampaignBookingsTable(earnedRows, clawbackRows, campaignSlug) {
  const slug = String(campaignSlug || '(default)');
  const filter = (row) => campaignSlugFromLedgerRow(row) === slug;
  const earned = (earnedRows || []).filter(filter);
  const clawback = (clawbackRows || []).filter(filter);

  const clawbackByBooking = new Map();
  for (const row of clawback) {
    const bid = row.booking_id ? String(row.booking_id) : '';
    if (!bid) continue;
    clawbackByBooking.set(bid, round2((clawbackByBooking.get(bid) || 0) + (Number(row.amount_thb) || 0)));
  }

  const byBooking = new Map();
  for (const row of earned) {
    const bid = row.booking_id ? String(row.booking_id) : '';
    if (!bid) continue;
    const earnedAt = String(row.earned_at || row.created_at || '');
    if (!byBooking.has(bid)) {
      byBooking.set(bid, { bookingId: bid, spendThb: 0, earnedAt });
    }
    const agg = byBooking.get(bid);
    agg.spendThb = round2(agg.spendThb + (Number(row.amount_thb) || 0));
    if (earnedAt && (!agg.earnedAt || earnedAt > agg.earnedAt)) agg.earnedAt = earnedAt;
  }

  const bookingMap = byBooking.size
    ? await fetchBookingCommissionMap([...byBooking.keys()])
    : new Map();

  return [...byBooking.values()]
    .map((b) => {
      const booking = bookingMap.get(b.bookingId) || {};
      const commissionThb = round2(Number(booking.commission_thb) || 0);
      const clawbackThb = round2(clawbackByBooking.get(b.bookingId) || 0);
      const netEffectThb = round2(commissionThb - b.spendThb - clawbackThb);
      return {
        bookingId: b.bookingId,
        status: booking.status || null,
        createdAt: booking.created_at || null,
        earnedAt: b.earnedAt,
        spendThb: b.spendThb,
        commissionThb,
        clawbackThb,
        netEffectThb,
        priceThb: round2(Number(booking.price_thb) || 0),
        plHref: `/admin/finance/intelligence/bookings/${encodeURIComponent(b.bookingId)}`,
      };
    })
    .sort((a, b) => String(b.earnedAt || '').localeCompare(String(a.earnedAt || '')));
}

/**
 * Booking IDs marked fraud_suspicious in ledger or attributions (Stage 124.15).
 * @param {Array<Record<string, unknown>>} earnedRows
 * @param {Set<string>} [seed]
 */
export function mergeSuspiciousBookingIdsFromLedger(earnedRows, seed = new Set()) {
  const ids = new Set(seed);
  for (const row of earnedRows || []) {
    const meta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    if (meta.fraud_suspicious === true && row.booking_id) ids.add(String(row.booking_id));
  }
  return ids;
}

/**
 * @param {{ fromIso: string, toIso: string, campaignSlug?: string }} opts
 */
export async function fetchSuspiciousBookingIds({ fromIso, toIso, campaignSlug = '' }) {
  const ids = new Set();
  let attrQ = supabaseAdmin
    .from('referral_attributions')
    .select('booking_id, metadata')
    .not('booking_id', 'is', null)
    .gte('created_at', fromIso)
    .lte('created_at', toIso);
  const slug = String(campaignSlug || '').trim();
  if (slug && slug !== '(default)') attrQ = attrQ.contains('metadata', { campaign_slug: slug });
  const { data, error } = await attrQ;
  if (error) throw new Error(error.message || 'SUSPICIOUS_ATTR_READ_FAILED');
  for (const row of data || []) {
    const meta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    if (meta.fraud_suspicious === true && row.booking_id) ids.add(String(row.booking_id));
  }
  return ids;
}

/**
 * @param {Array<Record<string, unknown>>} rows
 * @param {Set<string>} excludeBookingIds
 */
export function filterLedgerRowsExcludingBookings(rows, excludeBookingIds) {
  if (!excludeBookingIds?.size) return rows || [];
  return (rows || []).filter((row) => {
    const bid = row.booking_id ? String(row.booking_id) : '';
    return !bid || !excludeBookingIds.has(bid);
  });
}

/**
 * Period ROI from ledger rows, optionally excluding suspicious bookings.
 * @param {Array<Record<string, unknown>>} earnedRows
 * @param {Array<Record<string, unknown>>} clawbackRows
 * @param {Set<string>} [excludeBookingIds]
 */
export async function computePeriodRoiFromLedger(earnedRows, clawbackRows, excludeBookingIds = new Set()) {
  let spendThb = 0;
  const bookingIds = new Set();
  for (const row of earnedRows || []) {
    const bid = row.booking_id ? String(row.booking_id) : '';
    if (bid && excludeBookingIds.has(bid)) continue;
    spendThb += Number(row.amount_thb) || 0;
    if (bid) bookingIds.add(bid);
  }
  spendThb = round2(spendThb);

  let clawbackThb = 0;
  for (const row of clawbackRows || []) {
    const bid = row.booking_id ? String(row.booking_id) : '';
    if (bid && excludeBookingIds.has(bid)) continue;
    clawbackThb += Number(row.amount_thb) || 0;
  }
  clawbackThb = round2(clawbackThb);

  const bookingMap = bookingIds.size ? await fetchBookingCommissionMap([...bookingIds]) : new Map();
  let commissionThb = 0;
  for (const bid of bookingIds) {
    commissionThb += Number(bookingMap.get(bid)?.commission_thb) || 0;
  }
  commissionThb = round2(commissionThb);
  const grossMarginThb = round2(commissionThb - spendThb);
  const netEffectThb = round2(grossMarginThb - clawbackThb);
  const roiIndex = computeCampaignRoiIndex(commissionThb, spendThb);

  return {
    spendThb,
    commissionThb,
    clawbackThb,
    grossMarginThb,
    netEffectThb,
    roiIndex,
    roiPct: roiIndex != null ? round2(roiIndex * 100) : null,
    bookingsCount: bookingIds.size,
  };
}

/**
 * Fraud-adjusted block for dashboard / campaign drill-down.
 * @param {Record<string, unknown>} baseMetrics
 * @param {Awaited<ReturnType<typeof computePeriodRoiFromLedger>>} adjusted
 * @param {number} suspiciousBookingsCount
 */
export function buildFraudAdjustedRoiBlock(baseMetrics, adjusted, suspiciousBookingsCount) {
  const baseSpend = round2(baseMetrics?.spendThb ?? baseMetrics?.earnedBonusesThb ?? 0);
  const adjSpend = round2(adjusted.spendThb);
  const excludedSpendThb = round2(Math.max(0, baseSpend - adjSpend));

  let ownerNote =
    suspiciousBookingsCount > 0
      ? `Исключено ${suspiciousBookingsCount} подозрительных броней (anti-fraud).`
      : 'Подозрительных броней за период нет — показатели совпадают с обычным ROI.';
  if (suspiciousBookingsCount > 0 && adjusted.roiIndex != null && baseMetrics?.roiIndex != null) {
    const delta = round2(adjusted.roiIndex - Number(baseMetrics.roiIndex));
    if (delta > 0.05) {
      ownerNote += ` Без fraud ROI выше на ${delta.toFixed(2)}.`;
    } else if (delta < -0.05) {
      ownerNote += ` Без fraud ROI ниже на ${Math.abs(delta).toFixed(2)}.`;
    }
  }

  return {
    suspiciousBookingsCount,
    excludedSpendThb,
    spendThb: adjSpend,
    commissionThb: adjusted.commissionThb,
    clawbackThb: adjusted.clawbackThb,
    netEffectThb: adjusted.netEffectThb,
    grossMarginThb: adjusted.grossMarginThb,
    roiIndex: adjusted.roiIndex,
    roiPct: adjusted.roiPct,
    ownerNote,
  };
}

/**
 * LTV и retention гостей кампании (по referee_id в ledger за период).
 * @param {Array<Record<string, unknown>>} earnedRows
 * @param {string} campaignSlug
 */
export async function buildCampaignLtvRetentionBlock(earnedRows, campaignSlug) {
  const slug = String(campaignSlug || '(default)');
  const earned = (earnedRows || []).filter((r) => campaignSlugFromLedgerRow(r) === slug);

  /** @type {Map<string, Set<string>>} */
  const guestBookings = new Map();
  for (const row of earned) {
    const guest = String(row.referee_id || '').trim();
    const bid = String(row.booking_id || '').trim();
    if (!guest || !bid) continue;
    if (!guestBookings.has(guest)) guestBookings.set(guest, new Set());
    guestBookings.get(guest).add(bid);
  }

  const totalGuests = guestBookings.size;
  let repeatGuests = 0;
  let repeatBookingsCount = 0;
  let totalBookings = 0;
  const allBookingIds = new Set();

  for (const [, bids] of guestBookings) {
    const n = bids.size;
    totalBookings += n;
    for (const bid of bids) allBookingIds.add(bid);
    if (n >= 2) {
      repeatGuests += 1;
      repeatBookingsCount += n - 1;
    }
  }

  const bookingMap = allBookingIds.size
    ? await fetchBookingCommissionMap([...allBookingIds])
    : new Map();
  let commissionThb = 0;
  for (const bid of allBookingIds) {
    commissionThb += Number(bookingMap.get(bid)?.commission_thb) || 0;
  }
  commissionThb = round2(commissionThb);

  const retentionPct =
    totalGuests > 0 ? round2((repeatGuests / totalGuests) * 100) : null;
  const ltvThb = totalGuests > 0 ? round2(commissionThb / totalGuests) : null;
  const avgBookingsPerGuest =
    totalGuests > 0 ? round2(totalBookings / totalGuests) : null;

  let ownerNote = 'За период нет гостей с бронями по этой кампании.';
  if (totalGuests > 0) {
    ownerNote =
      retentionPct != null && retentionPct >= 20
        ? `LTV ≈ ฿${ltvThb?.toLocaleString('ru-RU') ?? '—'} на гостя; ${retentionPct}% вернулись с повторной бронью — удержание хорошее.`
        : `LTV ≈ ฿${ltvThb?.toLocaleString('ru-RU') ?? '—'} на гостя; ${repeatGuests} из ${totalGuests} гостей сделали повторную бронь (${retentionPct ?? 0}%).`;
  }

  return {
    totalGuests,
    firstTimeGuests: Math.max(0, totalGuests - repeatGuests),
    repeatGuests,
    totalBookings,
    repeatBookingsCount,
    retentionPct,
    ltvThb,
    avgBookingsPerGuest,
    commissionThb,
    ownerNote,
  };
}

/**
 * Короткие выводы для владельца (ROI-пульт).
 * @param {{ overall?: Record<string, unknown>, fraudAdjusted?: Record<string, unknown>, campaigns?: Array<Record<string, unknown>>, realtimeAlerts?: Array<Record<string, unknown>>, periodPreset?: string }} ctx
 */
export function buildRoiBusinessSummary(ctx = {}) {
  const overall = ctx.overall || {};
  const fraudAdjusted = ctx.fraudAdjusted || {};
  const periodPreset = ctx.periodPreset || '30d';
  const periodLabel =
    periodPreset === '7d' ? '7 дней' : periodPreset === 'today' ? 'сегодня' : '30 дней';

  /** @type {string[]} */
  const bullets = [];
  const spend = round2(overall.earnedBonusesThb ?? overall.referralSpendThb ?? 0);
  const roi = overall.roiIndex;

  if (spend <= 0) {
    bullets.push(`За ${periodLabel} нет расхода на бонусы — ROI появится после первых начислений.`);
  } else if (roi != null && roi >= 1) {
    bullets.push(
      `За ${periodLabel} программа окупается: ROI ${Number(roi).toFixed(2)} — комиссия покрывает бонусы.`,
    );
  } else if (roi != null) {
    bullets.push(
      `За ${periodLabel} ROI ${Number(roi).toFixed(2)} ниже 1 — расход promo выше комиссии; проверьте слабые кампании.`,
    );
  }

  const crit = (ctx.realtimeAlerts || []).filter((a) => a.level === 'critical').length;
  if (crit > 0) {
    bullets.push(`${crit} критических алертов — бюджет или ROI требуют внимания (см. баннер выше).`);
  }

  const withSpend = (ctx.campaigns || []).filter((c) => Number(c.spendThb) > 0);
  const top = [...withSpend].sort((a, b) => (b.roiIndex ?? -1) - (a.roiIndex ?? -1))[0];
  const weak = [...withSpend].sort((a, b) => (a.roiIndex ?? 999) - (b.roiIndex ?? 999))[0];
  if (top?.campaignSlug) {
    bullets.push(
      `Сильнее всего: «${top.campaignName || top.campaignSlug}» (ROI ${top.roiIndex != null ? Number(top.roiIndex).toFixed(2) : '—'}).`,
    );
  }
  if (
    weak?.campaignSlug &&
    top?.campaignSlug &&
    weak.campaignSlug !== top.campaignSlug &&
    weak.roiIndex != null &&
    weak.roiIndex < 1
  ) {
    bullets.push(
      `Слабее всего: «${weak.campaignName || weak.campaignSlug}» — откройте детали и P&L броней.`,
    );
  }

  const susp = Number(fraudAdjusted.suspiciousBookingsCount) || 0;
  if (susp > 0) {
    bullets.push(
      `Anti-fraud: ${susp} подозрительных броней — переключите «Fraud-adjusted», чтобы увидеть ROI без них.`,
    );
  }

  const headline = bullets[0] || 'Выберите период и дождитесь начислений по реферальной программе.';
  return {
    headline,
    bullets: bullets.slice(0, 5),
    ownerNote: headline,
  };
}

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
