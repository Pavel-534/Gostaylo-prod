/**
 * Stage 124.8–124.9 — осмысленные подсказки и «реальная» прибыль (owner UX).
 */
import { calcPeriodDeltaPct } from '@/lib/analytics/core/period-resolver.js';
import { round2 } from '@/lib/services/marketing/referral-calculation.js';

const PERIOD_LABELS = {
  today: 'сегодня',
  '7d': '7 дней',
  '30d': '30 дней',
};

/**
 * @param {{
 *   periodPreset?: string,
 *   currentAgg: Record<string, number>,
 *   previousAgg: Record<string, number>,
 *   referralCurrent?: Record<string, unknown>,
 *   referralPrevious?: Record<string, unknown>,
 *   escrowPipeline?: { totalInPipeline?: number },
 *   treasuryFxCostThb?: number,
 * }} input
 */
export function buildPeriodInsightsBlock(input) {
  const current = input.currentAgg || {};
  const previous = input.previousAgg || {};
  const bookingsCount = Number(current.bookingsCount) || 0;
  const prevBookings = Number(previous.bookingsCount) || 0;
  const periodLabel = PERIOD_LABELS[input.periodPreset || '30d'] || input.periodPreset || 'период';

  const referralBonuses = Number(input.referralCurrent?.earnedBonusesThb) || 0;
  const referralClawback = Number(input.referralCurrent?.clawbackThb) || 0;
  const referralOutflow = round2(Math.max(0, referralBonuses - referralClawback));
  const platformMarginThb = round2(current.platformMarginThb);

  const ruFeeThb = round2(current.ruFeeThb);
  const krFeeThb = round2(current.krFeeThb);
  const fxMarkupThb = round2(current.fxMarkupThb);
  const jurisdictionOutflowThb = round2(ruFeeThb + krFeeThb + fxMarkupThb);
  const treasuryFxCostThb = round2(input.treasuryFxCostThb);
  const insuranceReserveThb = round2(current.insuranceReserveThb);

  const netProfitThb = round2(platformMarginThb - referralOutflow);
  const netProfitAfterAllThb = round2(
    platformMarginThb -
      referralOutflow -
      (jurisdictionOutflowThb > 0 ? jurisdictionOutflowThb : 0) -
      treasuryFxCostThb -
      insuranceReserveThb,
  );

  const prevReferralOutflow = round2(
    Math.max(
      0,
      (Number(input.referralPrevious?.earnedBonusesThb) || 0) -
        (Number(input.referralPrevious?.clawbackThb) || 0),
    ),
  );
  const prevNetAfterAll = round2(
    (previous.platformMarginThb || 0) -
      prevReferralOutflow -
      (Number(previous.ruFeeThb) || 0) -
      (Number(previous.krFeeThb) || 0) -
      (Number(previous.fxMarkupThb) || 0) -
      (Number(previous.insuranceReserveThb) || 0),
  );

  const profitSummary = {
    gmvThb: round2(current.gmvThb),
    platformMarginThb,
    platformMarginPoolThb: round2(current.platformMarginPoolThb),
    referralOutflowThb: referralOutflow,
    ruFeeThb,
    krFeeThb,
    fxMarkupThb,
    jurisdictionOutflowThb,
    insuranceReserveThb,
    treasuryFxCostThb,
    netProfitThb,
    netProfitAfterAllThb,
    guestPayableThb: round2(current.guestPayableThb),
    partnerPayoutThb: round2(current.partnerPayoutThb),
    bookingsCount,
    settlementV3Count: Number(current.settlementV3Count) || 0,
    referralBookingsCount: Number(current.referralBookingsCount) || 0,
    vsPrevious: {
      gmvDeltaPct: calcPeriodDeltaPct(current.gmvThb, previous.gmvThb),
      marginDeltaPct: calcPeriodDeltaPct(current.platformMarginThb, previous.platformMarginThb),
      profitDeltaPct: calcPeriodDeltaPct(netProfitAfterAllThb, prevNetAfterAll),
      bookingsDelta: bookingsCount - prevBookings,
      prevGmvThb: round2(previous.gmvThb),
      prevMarginThb: round2(previous.platformMarginThb),
      prevBookingsCount: prevBookings,
      prevNetProfitAfterAllThb: prevNetAfterAll,
    },
  };

  const pipelineCount = Number(input.escrowPipeline?.totalInPipeline) || 0;
  const isEmpty = bookingsCount === 0;
  const isLow = bookingsCount > 0 && bookingsCount < 3;

  let state = 'ok';
  let headline = `${bookingsCount} оплаченных броней за ${periodLabel}`;
  let subline =
    jurisdictionOutflowThb > 0
      ? `Чистая прибыль ${formatThb(netProfitAfterAllThb)} после RU/KG/FX, рефералов и резервов`
      : `Чистая маржа ${formatThb(netProfitThb)} после рефералов (разбивка RU/KG появится на v2-снимках)`;

  if (isEmpty && prevBookings > 0) {
    state = 'empty_vs_previous';
    headline = `За ${periodLabel} новых оплаченных броней нет`;
    subline = `В прошлом таком же периоде: ${prevBookings} броней · оборот ${formatThb(previous.gmvThb)} · маржа ${formatThb(previous.platformMarginThb)}`;
  } else if (isEmpty && pipelineCount > 0) {
    state = 'empty_with_pipeline';
    headline = `За ${periodLabel} оплат в отчёт ещё не попало`;
    subline = `В эскроу сейчас ${pipelineCount} броней — деньги уже на платформе, откройте «В эскроу» или расширьте период`;
  } else if (isEmpty) {
    state = 'empty';
    headline = `За ${periodLabel} нет оплаченных броней`;
    subline = 'Попробуйте период 30 дней или проверьте тестовые фильтры (excludeTest)';
  } else if (isLow) {
    state = 'low';
    headline = `Мало броней (${bookingsCount}) — цифры ориентировочные`;
    subline =
      prevBookings > 0
        ? `Для сравнения: в прошлом периоде было ${prevBookings} броней, оборот ${formatThb(previous.gmvThb)}`
        : subline;
  }

  return {
    state,
    headline,
    subline,
    periodLabel,
    isEmpty,
    isLow,
    profitSummary,
    chartHint: isEmpty
      ? prevBookings > 0
        ? 'График скрыт — в текущем периоде нет дневной выручки. Ниже — сравнение с прошлым периодом.'
        : 'График появится после первых оплаченных броней.'
      : null,
  };
}

function formatThb(n) {
  return `฿${Number(n || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}`;
}
