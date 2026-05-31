/**
 * Stage 124.9 — SSOT чтение pricing_snapshot (final_breakdown → fee_split_v2 → settlement_v3).
 */
import { round2 } from '@/lib/services/marketing/referral-calculation.js';

/**
 * @param {Record<string, unknown> | null | undefined} snapshot
 * @param {string} key
 */
export function readBreakdownThb(snapshot, key) {
  const fb = snapshot?.final_breakdown;
  const fs = snapshot?.fee_split_v2;
  const v = fb?.[key] ?? fs?.[key];
  const n = Number(v);
  return Number.isFinite(n) ? round2(n) : 0;
}

/**
 * Юрисдикции и пул маржи (ADR-097: RU ~7% / KG ~8% от platform_margin_pool).
 * @param {Record<string, unknown> | null | undefined} snapshot
 */
export function readJurisdictionFromSnapshot(snapshot) {
  const fb = snapshot?.final_breakdown;
  const fs = snapshot?.fee_split_v2;
  const settlement = snapshot?.settlement_v3;

  const ruFeeThb = round2(
    fb?.ru_fee_thb ?? fb?.platform_margin_ru_thb ?? fs?.ru_fee_thb ?? 0,
  );
  const krFeeThb = round2(
    fb?.kr_fee_thb ?? fb?.platform_margin_kg_thb ?? fs?.kr_fee_thb ?? 0,
  );
  const fxMarkupThb = round2(fb?.fx_markup_thb ?? fs?.fx_markup_thb ?? 0);

  let platformMarginPoolThb = readBreakdownThb(snapshot, 'platform_margin_pool_thb');
  if (platformMarginPoolThb <= 0 && settlement?.platform_margin?.thb != null) {
    const margin = round2(settlement.platform_margin.thb);
    const insurance = round2(settlement?.insurance_reserve_amount?.thb);
    platformMarginPoolThb = round2(Math.max(0, margin - insurance));
  }

  const insuranceReserveThb =
    settlement?.insurance_reserve_amount?.thb != null
      ? round2(settlement.insurance_reserve_amount.thb)
      : readBreakdownThb(snapshot, 'insurance_reserve_thb');

  const pricingSnapshotVersion = snapshot?.v ?? (fb ? 2 : fs ? 1 : 0);

  return {
    ruFeeThb,
    krFeeThb,
    fxMarkupThb,
    platformMarginPoolThb,
    insuranceReserveThb,
    hasFinalBreakdown: Boolean(fb),
    hasFeeSplitV2: Boolean(fs),
    hasSettlementV3: Boolean(settlement),
    pricingSnapshotVersion,
    breakdownSource: fb ? 'final_breakdown' : fs ? 'fee_split_v2' : settlement ? 'settlement_v3_only' : 'legacy',
  };
}

/**
 * @param {Record<string, unknown> | null | undefined} snapshot
 */
export function readGuestBruttoThb(snapshot, fallbackThb = 0) {
  const fromFb =
    readBreakdownThb(snapshot, 'total_guest_payable_rounded_thb') ||
    readBreakdownThb(snapshot, 'guest_payable_rounded_thb');
  if (fromFb > 0) return fromFb;
  const n = Number(fallbackThb);
  return Number.isFinite(n) ? round2(n) : 0;
}
