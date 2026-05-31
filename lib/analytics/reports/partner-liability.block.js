/**
 * Stage 124.6 — Partner liability в escrow pipeline (live drill-down).
 */
import { supabaseAdmin } from '@/lib/supabase';
import { isFintechTestBookingRow } from '@/lib/admin/fintech-test-data-markers.js';
import { round2 } from '@/lib/services/marketing/referral-calculation.js';
import { ESCROW_PIPELINE_STATUSES } from '@/lib/booking/status-sets.js';

/**
 * @param {{ excludeTest?: boolean }} [opts]
 */
export async function buildPartnerLiabilityReport(opts = {}) {
  const excludeTest = opts.excludeTest !== false;
  /** @type {Map<string, { partnerId: string, pipelineNetThb: number, readyNetThb: number, bookingsCount: number, byStatus: Record<string, number> }>} */
  const byPartner = new Map();

  for (const status of ESCROW_PIPELINE_STATUSES) {
    const { data } = await supabaseAdmin
      .from('bookings')
      .select('id, partner_id, partner_earnings_thb, status, guest_name, special_requests, renter_id, listing_id')
      .eq('status', status)
      .limit(5000);

    for (const row of data || []) {
      if (excludeTest && isFintechTestBookingRow(row)) continue;
      const partnerId = String(row.partner_id || '').trim();
      if (!partnerId) continue;

      const net = Number(row.partner_earnings_thb) || 0;
      const agg = byPartner.get(partnerId) || {
        partnerId,
        pipelineNetThb: 0,
        readyNetThb: 0,
        bookingsCount: 0,
        byStatus: {},
      };
      agg.pipelineNetThb += net;
      agg.bookingsCount += 1;
      agg.byStatus[status] = (agg.byStatus[status] || 0) + 1;
      if (status === 'READY_FOR_PAYOUT') agg.readyNetThb += net;
      byPartner.set(partnerId, agg);
    }
  }

  const partnerIds = [...byPartner.keys()];
  const profileLabels = new Map();
  if (partnerIds.length) {
    for (let i = 0; i < partnerIds.length; i += 80) {
      const chunk = partnerIds.slice(i, i + 80);
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, email')
        .in('id', chunk);
      for (const p of profiles || []) {
        profileLabels.set(p.id, {
          name: p.full_name || p.email || p.id,
          email: p.email || null,
        });
      }
    }
  }

  const rows = [...byPartner.values()]
    .map((r) => {
      const label = profileLabels.get(r.partnerId);
      return {
        partnerId: r.partnerId,
        partnerName: label?.name || r.partnerId,
        partnerEmail: label?.email || null,
        pipelineNetThb: round2(r.pipelineNetThb),
        readyNetThb: round2(r.readyNetThb),
        bookingsCount: r.bookingsCount,
        byStatus: r.byStatus,
      };
    })
    .sort((a, b) => b.pipelineNetThb - a.pipelineNetThb);

  const totalPipelineNetThb = round2(rows.reduce((s, r) => s + r.pipelineNetThb, 0));
  const totalReadyNetThb = round2(rows.reduce((s, r) => s + r.readyNetThb, 0));

  return {
    rows,
    totals: {
      partnersCount: rows.length,
      totalPipelineNetThb,
      totalReadyNetThb,
      totalBookings: rows.reduce((s, r) => s + r.bookingsCount, 0),
    },
    pipelineStatuses: ESCROW_PIPELINE_STATUSES,
  };
}
