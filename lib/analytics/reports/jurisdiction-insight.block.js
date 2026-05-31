/**
 * Stage 124.8–124.9 — RU/KG/FX split (ADR-097: ~7% RU / ~8% KG от пула маржи).
 */
import { round2 } from '@/lib/services/marketing/referral-calculation.js';
import { calcPeriodDeltaPct } from '@/lib/analytics/core/period-resolver.js';

/** Номинальные доли ADR-097 для подписей владельцу (не пересчёт — только из снимка). */
const ADR_NOMINAL = {
  ruPct: 7,
  kgPct: 8,
  fxLabel: 'Наценка FX (KG)',
};

/**
 * @param {{
 *   currentFacts?: Array<{ ruFeeThb?: number, krFeeThb?: number, fxMarkupThb?: number, platformMarginPoolThb?: number, pricingSnapshotVersion?: number, hasSettlementV3?: boolean }>,
 *   currentAgg: Record<string, number>,
 *   previousAgg?: Record<string, number>,
 *   cashPosition?: { treasuryTimeline?: { totals?: { fxCostThb?: number } }, treasuryConversions?: { netCostThb?: number } },
 * }} input
 */
export function buildJurisdictionInsightBlock(input) {
  const facts = input.currentFacts || [];
  const current = input.currentAgg || {};
  const previous = input.previousAgg || {};

  const ruFeeThb = round2(current.ruFeeThb);
  const krFeeThb = round2(current.krFeeThb);
  const fxMarkupThb = round2(current.fxMarkupThb);
  const platformMarginThb = round2(current.platformMarginThb);
  const platformMarginPoolThb = round2(current.platformMarginPoolThb || platformMarginThb);

  const v2Count = facts.filter(
    (f) =>
      (f.pricingSnapshotVersion ?? 0) >= 2 ||
      Number(f.ruFeeThb) > 0 ||
      Number(f.krFeeThb) > 0 ||
      f.hasSettlementV3,
  ).length;
  const v2CoveragePct = facts.length > 0 ? round2((v2Count / facts.length) * 100) : null;
  const settlementV3Pct =
    facts.length > 0
      ? round2((facts.filter((f) => f.hasSettlementV3).length / facts.length) * 100)
      : null;

  const treasuryFxCostThb = round2(
    input.cashPosition?.treasuryTimeline?.totals?.fxCostThb ??
      input.cashPosition?.treasuryConversions?.netCostThb ??
      0,
  );

  const poolTotal = round2(ruFeeThb + krFeeThb + fxMarkupThb);
  const hasJurisdictionData = poolTotal > 0;
  const hasTreasuryFx = treasuryFxCostThb > 0;

  const platformRetainedThb = round2(
    Math.max(0, platformMarginThb - poolTotal - treasuryFxCostThb),
  );

  let displayState = 'ok';
  let ownerNote =
    v2CoveragePct != null && v2CoveragePct < 100
      ? `${v2CoveragePct}% броней с полной разбивкой из pricing_snapshot.final_breakdown (ADR-097).`
      : 'Разбивка RU/KG/FX из final_breakdown и settlement_v3.';

  if (!hasJurisdictionData && !hasTreasuryFx) {
    displayState = facts.length === 0 ? 'no_bookings' : 'legacy_pricing';
    ownerNote =
      facts.length === 0
        ? 'Нет броней за период — разбивка появится после оплат.'
        : 'У броней периода нет v2-снимка. Маржа платформы в KPI выше всё равно учтена.';
  } else if (!hasJurisdictionData && hasTreasuryFx) {
    displayState = 'treasury_only';
    ownerNote = `В снимках нет RU/KG, но в казне за 30 дн. FX-расход: ${formatThb(treasuryFxCostThb)}.`;
  }

  const rows = [
    {
      id: 'ru',
      label: `Агентство RU (~${ADR_NOMINAL.ruPct}%)`,
      valueThb: ruFeeThb,
      sharePct: poolTotal > 0 ? round2((ruFeeThb / poolTotal) * 100) : 0,
      shareOfMarginPct:
        platformMarginPoolThb > 0 ? round2((ruFeeThb / platformMarginPoolThb) * 100) : 0,
      adrNominalPct: ADR_NOMINAL.ruPct,
    },
    {
      id: 'kg',
      label: `Сервис KG (~${ADR_NOMINAL.kgPct}%)`,
      valueThb: krFeeThb,
      sharePct: poolTotal > 0 ? round2((krFeeThb / poolTotal) * 100) : 0,
      shareOfMarginPct:
        platformMarginPoolThb > 0 ? round2((krFeeThb / platformMarginPoolThb) * 100) : 0,
      adrNominalPct: ADR_NOMINAL.kgPct,
    },
    {
      id: 'fx',
      label: ADR_NOMINAL.fxLabel,
      valueThb: fxMarkupThb,
      sharePct: poolTotal > 0 ? round2((fxMarkupThb / poolTotal) * 100) : 0,
      shareOfMarginPct:
        platformMarginPoolThb > 0 ? round2((fxMarkupThb / platformMarginPoolThb) * 100) : 0,
    },
  ];

  if (hasTreasuryFx) {
    rows.push({
      id: 'treasury_fx',
      label: 'Расход FX (казна, 30 дн.)',
      valueThb: treasuryFxCostThb,
      sharePct: null,
      isTreasury: true,
    });
  }

  if (platformRetainedThb > 0 && hasJurisdictionData) {
    rows.push({
      id: 'retained',
      label: 'Остаток на платформе (после RU/KG/FX)',
      valueThb: platformRetainedThb,
      sharePct: null,
      isRetained: true,
    });
  }

  return {
    ruFeeThb,
    krFeeThb,
    fxMarkupThb,
    platformMarginThb,
    platformMarginPoolThb,
    poolTotalThb: poolTotal,
    platformRetainedThb,
    treasuryFxCostThb,
    v2CoveragePct,
    settlementV3Pct,
    adrNominal: ADR_NOMINAL,
    displayState,
    ownerNote,
    rows,
    vsPrevious: {
      ruDeltaPct: calcPeriodDeltaPct(ruFeeThb, previous.ruFeeThb),
      krDeltaPct: calcPeriodDeltaPct(krFeeThb, previous.krFeeThb),
      fxDeltaPct: calcPeriodDeltaPct(fxMarkupThb, previous.fxMarkupThb),
    },
  };
}

function formatThb(n) {
  return `฿${Number(n || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}`;
}
