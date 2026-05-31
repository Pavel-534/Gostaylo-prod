/**
 * Stage 124.4 — плоский финансовый факт по брони (read-only SSOT row).
 * Базируется на `buildBookingFinancialSnapshotFromRow`; не дублирует math.
 */
import { supabaseAdmin } from '@/lib/supabase';
import {
  buildBookingFinancialSnapshotFromRow,
  categorySlugFromBookingFinancialRow,
} from '@/lib/services/booking-financial-read-model.service';
import { isFintechTestBookingRow } from '@/lib/admin/fintech-test-data-markers.js';
import { round2 } from '@/lib/services/marketing/referral-calculation.js';
import {
  readGuestBruttoThb,
  readJurisdictionFromSnapshot,
} from '@/lib/analytics/core/pricing-snapshot-read.js';

import { ESCROW_PIPELINE_STATUSES } from '@/lib/booking/status-sets.js';

const MS_DAY = 24 * 60 * 60 * 1000;

const BOOKING_FACT_SELECT = `
  id, status, created_at, updated_at, partner_id, renter_id, listing_id,
  price_thb, commission_thb, partner_earnings_thb, price_paid, exchange_rate, currency,
  pricing_snapshot, metadata, escrow_thaw_at,
  listing:listings(category_id, categories(slug))
`;

function bookingPaidAtIso(booking) {
  const meta = booking?.metadata && typeof booking.metadata === 'object' ? booking.metadata : {};
  const candidates = [
    meta.payment_confirmed_at,
    meta.paid_at,
    meta.escrow_paid_at,
  ];
  for (const c of candidates) {
    if (c) {
      const t = Date.parse(String(c));
      if (Number.isFinite(t)) return new Date(t).toISOString();
    }
  }
  if (['PAID_ESCROW', 'CHECKED_IN', 'THAWED', 'READY_FOR_PAYOUT', 'COMPLETED', 'PAID'].includes(String(booking?.status))) {
    return booking.updated_at || booking.created_at || null;
  }
  return null;
}

/**
 * @param {Record<string, unknown>} booking
 * @returns {import('../types.js').BookingFinancialFact | null}
 */
export function buildBookingFinancialFactFromRow(booking) {
  const base = buildBookingFinancialSnapshotFromRow(booking);
  if (!base) return null;

  const snapshot =
    booking.pricing_snapshot && typeof booking.pricing_snapshot === 'object'
      ? booking.pricing_snapshot
      : {};
  const meta = booking.metadata && typeof booking.metadata === 'object' ? booking.metadata : {};

  const jurisdiction = readJurisdictionFromSnapshot(snapshot);
  const guestBruttoThb = readGuestBruttoThb(snapshot, base.guestPayableThb);

  const paidAt = bookingPaidAtIso(booking);
  const referralAttributionId = meta.referral_attribution_id
    ? String(meta.referral_attribution_id)
    : null;

  return {
    bookingId: base.bookingId,
    status: base.status,
    partnerId: booking.partner_id ? String(booking.partner_id) : null,
    renterId: booking.renter_id ? String(booking.renter_id) : null,
    listingId: booking.listing_id ? String(booking.listing_id) : null,
    categorySlug: base.category_slug || categorySlugFromBookingFinancialRow(booking),
    currency: base.currency,
    createdAt: booking.created_at || null,
    paidAt,
    escrowThawAt: booking.escrow_thaw_at || null,

    subtotalThb: base.subtotalThb,
    guestServiceFeeThb: base.guestServiceFeeThb,
    hostCommissionThb: base.hostCommissionThb,
    platformMarginThb: base.platformMarginThb,
    partnerPayoutThb: base.partnerPayoutThb,
    guestPayableThb: base.guestPayableThb,
    guestBruttoThb,
    taxableMarginThb: base.taxableMarginAmountThb,

    ruFeeThb: jurisdiction.ruFeeThb,
    krFeeThb: jurisdiction.krFeeThb,
    fxMarkupThb: jurisdiction.fxMarkupThb,
    platformMarginPoolThb: jurisdiction.platformMarginPoolThb,
    insuranceReserveThb: jurisdiction.insuranceReserveThb,
    breakdownSource: jurisdiction.breakdownSource,

    hasReferralAttribution: Boolean(referralAttributionId),
    referralAttributionId,
    pricingSnapshotVersion: jurisdiction.pricingSnapshotVersion,
    hasSettlementV3: jurisdiction.hasSettlementV3,
    hasLedgerCapture: ['PAID_ESCROW', 'CHECKED_IN', 'THAWED', 'READY_FOR_PAYOUT', 'COMPLETED'].includes(base.status),
  };
}

/**
 * @param {string} bookingId
 */
export async function readBookingFinancialFact(bookingId) {
  const id = String(bookingId || '').trim();
  if (!id) return { success: false, error: 'BOOKING_ID_REQUIRED' };

  const { data, error } = await supabaseAdmin
    .from('bookings')
    .select(BOOKING_FACT_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) return { success: false, error: error.message || 'BOOKING_READ_FAILED' };
  if (!data) return { success: false, error: 'BOOKING_NOT_FOUND' };

  return { success: true, data: buildBookingFinancialFactFromRow(data) };
}

/**
 * @param {{ fromIso: string, toIso: string, excludeTest?: boolean, limit?: number, statuses?: string[] }} opts
 */
export async function fetchBookingFinancialFacts({
  fromIso,
  toIso,
  excludeTest = true,
  limit = 5000,
  statuses = null,
} = {}) {
  let q = supabaseAdmin
    .from('bookings')
    .select(BOOKING_FACT_SELECT)
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (Array.isArray(statuses) && statuses.length) {
    q = q.in('status', statuses);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message || 'BOOKING_FACTS_FETCH_FAILED');

  const facts = [];
  for (const row of data || []) {
    if (excludeTest && isFintechTestBookingRow(row)) continue;
    const fact = buildBookingFinancialFactFromRow(row);
    if (fact) facts.push(fact);
  }
  return facts;
}

function calcPipelineAgeDays(row) {
  const t = Date.parse(String(row?.updated_at || row?.created_at || ''));
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, (Date.now() - t) / MS_DAY);
}

async function resolveListingIdsForCategorySlug(categorySlug) {
  const slug = String(categorySlug || '').trim();
  if (!slug) return null;

  const { data: cat, error: catErr } = await supabaseAdmin
    .from('categories')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (catErr) throw new Error(catErr.message || 'CATEGORY_LOOKUP_FAILED');
  if (!cat?.id) return [];

  const { data: listings, error: listErr } = await supabaseAdmin
    .from('listings')
    .select('id')
    .eq('category_id', cat.id)
    .limit(8000);
  if (listErr) throw new Error(listErr.message || 'LISTINGS_LOOKUP_FAILED');
  return (listings || []).map((l) => l.id);
}

/**
 * @param {{
 *   fromIso?: string | null,
 *   toIso?: string | null,
 *   excludeTest?: boolean,
 *   status?: string | null,
 *   categorySlug?: string | null,
 *   partnerId?: string | null,
 *   partnerPipelineOnly?: boolean,
 *   hasReferral?: boolean | null,
 *   pipelineOnly?: boolean,
 *   escrowAgingMinDays?: number | null,
 *   page?: number,
 *   pageSize?: number,
 * }} opts
 */
export async function queryBookingFinancialFactsPage(opts = {}) {
  const excludeTest = opts.excludeTest !== false;
  const page = Math.max(1, Number(opts.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(opts.pageSize) || 25));
  const offset = (page - 1) * pageSize;

  let q = supabaseAdmin
    .from('bookings')
    .select(BOOKING_FACT_SELECT, { count: 'exact' })
    .order('updated_at', { ascending: false });

  const pipelineOnly =
    Boolean(opts.pipelineOnly) || opts.escrowAgingMinDays != null || Boolean(opts.partnerPipelineOnly);

  let listingIdsForCategory = null;
  if (opts.categorySlug) {
    listingIdsForCategory = await resolveListingIdsForCategorySlug(opts.categorySlug);
    if (Array.isArray(listingIdsForCategory) && listingIdsForCategory.length === 0) {
      return {
        rows: [],
        pagination: { page, pageSize, total: 0, hasMore: false },
        filters: {
          fromIso: opts.fromIso || null,
          toIso: opts.toIso || null,
          status: opts.status || null,
          categorySlug: opts.categorySlug || null,
          partnerId: opts.partnerId || null,
          partnerPipelineOnly: Boolean(opts.partnerPipelineOnly),
          hasReferral: opts.hasReferral ?? null,
          pipelineOnly,
          escrowAgingMinDays: opts.escrowAgingMinDays ?? null,
        },
      };
    }
  }

  if (pipelineOnly) {
    q = q.in('status', [...ESCROW_PIPELINE_STATUSES]);
    if (opts.escrowAgingMinDays != null) {
      const minDays = Number(opts.escrowAgingMinDays);
      if (Number.isFinite(minDays) && minDays > 0) {
        const cutoff = new Date(Date.now() - minDays * MS_DAY).toISOString();
        q = q.lte('updated_at', cutoff);
      }
    }
  } else {
    if (opts.fromIso) q = q.gte('created_at', opts.fromIso);
    if (opts.toIso) q = q.lte('created_at', opts.toIso);
    if (opts.status) q = q.eq('status', String(opts.status));
  }

  if (opts.partnerId) q = q.eq('partner_id', String(opts.partnerId));
  if (listingIdsForCategory?.length) q = q.in('listing_id', listingIdsForCategory);

  if (opts.hasReferral === true) {
    q = q.not('metadata->referral_attribution_id', 'is', null);
  } else if (opts.hasReferral === false) {
    q = q.is('metadata->referral_attribution_id', null);
  }

  q = q.range(offset, offset + pageSize - 1);

  const { data, error, count } = await q;
  if (error) throw new Error(error.message || 'BOOKING_FACTS_PAGE_FAILED');

  const rows = [];
  for (const row of data || []) {
    if (excludeTest && isFintechTestBookingRow(row)) continue;
    const fact = buildBookingFinancialFactFromRow(row);
    if (!fact) continue;
    rows.push({
      ...fact,
      pipelineAgeDays: pipelineOnly ? round2(calcPipelineAgeDays(row)) : null,
    });
  }

  return {
    rows,
    pagination: {
      page,
      pageSize,
      total: count ?? rows.length,
      hasMore: count != null ? offset + pageSize < count : rows.length === pageSize,
    },
    filters: {
      fromIso: opts.fromIso || null,
      toIso: opts.toIso || null,
      status: opts.status || null,
      categorySlug: opts.categorySlug || null,
      partnerId: opts.partnerId || null,
      partnerPipelineOnly: Boolean(opts.partnerPipelineOnly),
      hasReferral: opts.hasReferral ?? null,
      pipelineOnly,
      escrowAgingMinDays: opts.escrowAgingMinDays ?? null,
    },
  };
}

/**
 * Агрегат по массиву фактов (period rollup).
 * @param {import('../types.js').BookingFinancialFact[]} facts
 */
export function aggregateBookingFinancialFacts(facts) {
  const init = {
    bookingsCount: 0,
    gmvThb: 0,
    guestPayableThb: 0,
    platformMarginThb: 0,
    partnerPayoutThb: 0,
    ruFeeThb: 0,
    krFeeThb: 0,
    fxMarkupThb: 0,
    platformMarginPoolThb: 0,
    insuranceReserveThb: 0,
    settlementV3Count: 0,
    referralBookingsCount: 0,
  };

  for (const f of facts || []) {
    init.bookingsCount += 1;
    init.gmvThb += Number(f.subtotalThb) || 0;
    init.guestPayableThb += Number(f.guestBruttoThb || f.guestPayableThb) || 0;
    init.platformMarginThb += Number(f.platformMarginThb) || 0;
    init.partnerPayoutThb += Number(f.partnerPayoutThb) || 0;
    init.ruFeeThb += Number(f.ruFeeThb) || 0;
    init.krFeeThb += Number(f.krFeeThb) || 0;
    init.fxMarkupThb += Number(f.fxMarkupThb) || 0;
    init.platformMarginPoolThb += Number(f.platformMarginPoolThb) || 0;
    init.insuranceReserveThb += Number(f.insuranceReserveThb) || 0;
    if (f.hasSettlementV3) init.settlementV3Count += 1;
    if (f.hasReferralAttribution) init.referralBookingsCount += 1;
  }

  return {
    bookingsCount: init.bookingsCount,
    gmvThb: round2(init.gmvThb),
    guestPayableThb: round2(init.guestPayableThb),
    platformMarginThb: round2(init.platformMarginThb),
    partnerPayoutThb: round2(init.partnerPayoutThb),
    ruFeeThb: round2(init.ruFeeThb),
    krFeeThb: round2(init.krFeeThb),
    fxMarkupThb: round2(init.fxMarkupThb),
    platformMarginPoolThb: round2(init.platformMarginPoolThb),
    insuranceReserveThb: round2(init.insuranceReserveThb),
    settlementV3Count: init.settlementV3Count,
    referralBookingsCount: init.referralBookingsCount,
  };
}
