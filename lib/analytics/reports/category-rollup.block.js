/**
 * Stage 124.6 — GMV / margin rollup по category_slug (vertical).
 */
import { round2 } from '@/lib/services/marketing/referral-calculation.js';

const UNCATEGORIZED = '(uncategorized)';

/**
 * @param {import('../types.js').BookingFinancialFact[]} facts
 */
export function buildCategoryRollupFromFacts(facts) {
  const bySlug = new Map();

  for (const f of facts || []) {
    const slug = String(f.categorySlug || '').trim() || UNCATEGORIZED;
    const row = bySlug.get(slug) || {
      categorySlug: slug,
      bookingsCount: 0,
      gmvThb: 0,
      platformMarginThb: 0,
      partnerPayoutThb: 0,
      guestPayableThb: 0,
      referralBookingsCount: 0,
    };
    row.bookingsCount += 1;
    row.gmvThb += Number(f.subtotalThb) || 0;
    row.platformMarginThb += Number(f.platformMarginThb) || 0;
    row.partnerPayoutThb += Number(f.partnerPayoutThb) || 0;
    row.guestPayableThb += Number(f.guestBruttoThb || f.guestPayableThb) || 0;
    if (f.hasReferralAttribution) row.referralBookingsCount += 1;
    bySlug.set(slug, row);
  }

  const totalGmv = [...bySlug.values()].reduce((s, r) => s + r.gmvThb, 0);
  const totalMargin = [...bySlug.values()].reduce((s, r) => s + r.platformMarginThb, 0);

  const rows = [...bySlug.values()]
    .map((r) => ({
      categorySlug: r.categorySlug,
      bookingsCount: r.bookingsCount,
      gmvThb: round2(r.gmvThb),
      platformMarginThb: round2(r.platformMarginThb),
      partnerPayoutThb: round2(r.partnerPayoutThb),
      guestPayableThb: round2(r.guestPayableThb),
      referralBookingsCount: r.referralBookingsCount,
      gmvSharePct: totalGmv > 0 ? round2((r.gmvThb / totalGmv) * 100) : 0,
      marginSharePct: totalMargin > 0 ? round2((r.platformMarginThb / totalMargin) * 100) : 0,
    }))
    .sort((a, b) => b.gmvThb - a.gmvThb);

  return {
    rows,
    totals: {
      gmvThb: round2(totalGmv),
      platformMarginThb: round2(totalMargin),
      categoriesCount: rows.length,
    },
  };
}
