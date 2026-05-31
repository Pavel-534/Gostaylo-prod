/**
 * Stage 124.6 — CSV export SSOT for Financial Intelligence.
 */
import { resolveAnalyticsPeriod } from '@/lib/analytics/core/period-resolver.js';
import {
  fetchBookingFinancialFacts,
  queryBookingFinancialFactsPage,
} from '@/lib/analytics/facts/booking-financial-fact.js';
import { buildEscrowAgingReport } from '@/lib/analytics/reports/escrow-aging.block.js';
import buildBookingPlReport from '@/lib/analytics/reports/booking-pl-report.js';

export const INTELLIGENCE_CSV_DELIMITER = ';';

const BOOKING_COLUMNS = [
  'booking_id',
  'status',
  'category_slug',
  'created_at',
  'paid_at',
  'subtotal_thb',
  'guest_payable_thb',
  'platform_margin_thb',
  'partner_payout_thb',
  'ru_fee_thb',
  'kr_fee_thb',
  'fx_markup_thb',
  'has_referral',
  'partner_id',
  'renter_id',
];

const ESCROW_AGING_COLUMNS = [
  'booking_id',
  'status',
  'partner_net_thb',
  'age_days',
  'updated_at',
];

const PL_BATCH_COLUMNS = [
  'booking_id',
  'status',
  'guest_payable_thb',
  'platform_gross_margin_thb',
  'referral_cost_thb',
  'net_platform_margin_thb',
  'partner_payout_thb',
  'ru_fee_thb',
  'kr_fee_thb',
  'fx_markup_thb',
  'ledger_capture',
  'referral_rows',
];

function csvEscape(v) {
  const raw = v == null ? '' : String(v);
  if (raw.includes(';') || raw.includes('"') || raw.includes('\n')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function toCsvString(columns, rows) {
  const header = columns.join(INTELLIGENCE_CSV_DELIMITER);
  const body = rows.map((cells) => cells.map(csvEscape).join(INTELLIGENCE_CSV_DELIMITER));
  return '\uFEFF' + [header, ...body].join('\n');
}

const REVENUE_STATUSES = [
  'PAID',
  'PAID_ESCROW',
  'CHECKED_IN',
  'THAWED',
  'READY_FOR_PAYOUT',
  'COMPLETED',
];

/**
 * @param {{ periodPreset?: string, excludeTest?: boolean }} opts
 */
export async function exportBookingsCsv(opts = {}) {
  const periods = resolveAnalyticsPeriod(opts.periodPreset || '30d');
  const facts = await fetchBookingFinancialFacts({
    fromIso: periods.current.fromIso,
    toIso: periods.current.toIso,
    excludeTest: opts.excludeTest !== false,
    statuses: REVENUE_STATUSES,
    limit: 10000,
  });

  const rows = facts.map((f) => [
    f.bookingId,
    f.status,
    f.categorySlug || '',
    f.createdAt || '',
    f.paidAt || '',
    f.subtotalThb,
    f.guestBruttoThb || f.guestPayableThb,
    f.platformMarginThb,
    f.partnerPayoutThb,
    f.ruFeeThb,
    f.krFeeThb,
    f.fxMarkupThb,
    f.hasReferralAttribution ? '1' : '0',
    f.partnerId || '',
    f.renterId || '',
  ]);

  const filename = `fi-bookings-${periods.preset}-${periods.current.fromIso.slice(0, 10)}.csv`;
  return { csv: toCsvString(BOOKING_COLUMNS, rows), filename, rowCount: rows.length };
}

/**
 * @param {{ excludeTest?: boolean, minDays?: number }} opts
 */
export async function exportEscrowAgingCsv(opts = {}) {
  const excludeTest = opts.excludeTest !== false;
  const minDays = Number(opts.minDays) || 7;
  const cutoff = new Date(Date.now() - minDays * 24 * 60 * 60 * 1000).toISOString();

  const page = await queryBookingFinancialFactsPage({
    pipelineOnly: true,
    escrowAgingMinDays: minDays,
    excludeTest,
    page: 1,
    pageSize: 5000,
  });

  const rows = (page.rows || []).map((f) => [
    f.bookingId,
    f.status,
    f.partnerPayoutThb,
    f.pipelineAgeDays ?? '',
    '',
  ]);

  const filename = `fi-escrow-aging-${minDays}d.csv`;
  return {
    csv: toCsvString(ESCROW_AGING_COLUMNS, rows),
    filename,
    rowCount: rows.length,
    cutoffIso: cutoff,
  };
}

/**
 * @param {{ bookingIds: string[], excludeTest?: boolean }} opts
 */
export async function exportPlBatchCsv(opts = {}) {
  const ids = [...new Set((opts.bookingIds || []).map(String).filter(Boolean))].slice(0, 200);
  if (!ids.length) {
    return { csv: toCsvString(PL_BATCH_COLUMNS, []), filename: 'fi-pl-batch-empty.csv', rowCount: 0 };
  }

  const rows = [];
  for (const id of ids) {
    const result = await buildBookingPlReport(id);
    if (!result.success) continue;
    const d = result.data;
    rows.push([
      d.bookingId,
      d.fact?.status || '',
      d.guest?.guestPayableThb,
      d.pl?.platformGrossMarginThb,
      d.pl?.referralCostThb,
      d.pl?.netPlatformMarginThb,
      d.pl?.partnerPayoutThb,
      d.jurisdiction?.ruFeeThb,
      d.jurisdiction?.krFeeThb,
      d.jurisdiction?.fxMarkupThb,
      d.ledger?.capturePosted ? '1' : '0',
      (d.referral?.rows || []).length,
    ]);
  }

  const filename = `fi-pl-batch-${ids.length}-bookings.csv`;
  return { csv: toCsvString(PL_BATCH_COLUMNS, rows), filename, rowCount: rows.length };
}
