/**
 * Stage 124.5 — Escrow aging buckets (live pipeline, read-only).
 */
import { supabaseAdmin } from '@/lib/supabase';
import { isFintechTestBookingRow } from '@/lib/admin/fintech-test-data-markers.js';
import { round2 } from '@/lib/services/marketing/referral-calculation.js';
import { ESCROW_PIPELINE_STATUSES } from '@/lib/booking/status-sets.js';

const MS_DAY = 24 * 60 * 60 * 1000;

export const ESCROW_AGING_BUCKETS = Object.freeze([
  { id: '7d', minDays: 7, label: '> 7 дней' },
  { id: '14d', minDays: 14, label: '> 14 дней' },
  { id: '30d', minDays: 30, label: '> 30 дней' },
]);

function pipelineAgeDays(row, nowMs = Date.now()) {
  const t = Date.parse(String(row?.updated_at || row?.created_at || ''));
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, (nowMs - t) / MS_DAY);
}

/**
 * @param {{ excludeTest?: boolean }} [opts]
 */
export async function buildEscrowAgingReport(opts = {}) {
  const excludeTest = opts.excludeTest !== false;
  const nowMs = Date.now();
  const buckets = ESCROW_AGING_BUCKETS.map((b) => ({
    ...b,
    count: 0,
    partnerNetThb: 0,
    byStatus: {},
  }));

  /** @type {Array<{ bookingId: string, status: string, partnerNetThb: number, ageDays: number, updatedAt: string | null }>} */
  const staleSample = [];

  for (const status of ESCROW_PIPELINE_STATUSES) {
    const { data } = await supabaseAdmin
      .from('bookings')
      .select('id, status, partner_earnings_thb, updated_at, created_at, guest_name, special_requests, renter_id, partner_id, listing_id')
      .eq('status', status)
      .limit(5000);

    for (const row of data || []) {
      if (excludeTest && isFintechTestBookingRow(row)) continue;
      const ageDays = pipelineAgeDays(row, nowMs);
      const net = Number(row.partner_earnings_thb) || 0;

      for (const bucket of buckets) {
        if (ageDays >= bucket.minDays) {
          bucket.count += 1;
          bucket.partnerNetThb += net;
          bucket.byStatus[status] = (bucket.byStatus[status] || 0) + 1;
        }
      }

      if (ageDays >= 7 && staleSample.length < 200) {
        staleSample.push({
          bookingId: String(row.id),
          status,
          partnerNetThb: round2(net),
          ageDays: round2(ageDays),
          updatedAt: row.updated_at || null,
        });
      }
    }
  }

  staleSample.sort((a, b) => b.ageDays - a.ageDays);

  return {
    buckets: buckets.map((b) => ({
      ...b,
      partnerNetThb: round2(b.partnerNetThb),
    })),
    staleSample: staleSample.slice(0, 50),
    pipelineStatuses: ESCROW_PIPELINE_STATUSES,
  };
}

export { pipelineAgeDays };
