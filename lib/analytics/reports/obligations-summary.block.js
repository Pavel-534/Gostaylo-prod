/**
 * Stage 124.9 — сводка долгов и обязательств (owner UX, read-only).
 */
import { round2 } from '@/lib/services/marketing/referral-calculation.js';

/**
 * @param {{
 *   escrowPipeline?: { partnerLiabilityThb?: number, totalInPipeline?: number, counts?: Record<string, number> },
 *   cashPosition?: {
 *     readyToPay?: { totalReadyThb?: number, totalReadyCount?: number },
 *     payoutBatches?: { openPayoutThb?: number, openBatchCount?: number },
 *     obligations?: {
 *       referralLiabilityThb?: number,
 *       promoTankBalanceThb?: number,
 *       walletExposureThb?: number,
 *     },
 *     summary?: { cashAtRiskThb?: number },
 *   },
 * }} input
 */
export function buildObligationsSummaryBlock(input) {
  const escrow = input.escrowPipeline || {};
  const cash = input.cashPosition || {};
  const obligations = cash.obligations || {};

  const partnerEscrowThb = round2(escrow.partnerLiabilityThb);
  const partnerReadyThb = round2(cash.readyToPay?.totalReadyThb);
  const openBatchesThb = round2(cash.payoutBatches?.openPayoutThb);
  const referralLiabilityThb = round2(obligations.referralLiabilityThb);
  const promoTankThb = round2(obligations.promoTankBalanceThb);

  const totalObligationsThb = round2(
    partnerEscrowThb + partnerReadyThb + openBatchesThb + referralLiabilityThb,
  );

  const rows = [
    {
      id: 'escrow',
      label: 'В эскроу (партнёрам)',
      valueThb: partnerEscrowThb,
      count: Number(escrow.totalInPipeline) || 0,
      hint: 'Деньги на платформе, ещё не готовы к выплате',
    },
    {
      id: 'ready',
      label: 'Готово к выплате',
      valueThb: partnerReadyThb,
      count: Number(cash.readyToPay?.totalReadyCount) || 0,
      hint: 'Статус READY_FOR_PAYOUT и аналоги',
    },
    {
      id: 'batches',
      label: 'Открытые payout-пулы',
      valueThb: openBatchesThb,
      count: Number(cash.payoutBatches?.openBatchCount) || 0,
      hint: 'DRAFT / LOCKED / EXPORTED',
    },
    {
      id: 'referral',
      label: 'Реферальные обязательства',
      valueThb: referralLiabilityThb,
      hint: 'Начислено минус выплачено',
    },
    {
      id: 'promo',
      label: 'Резерв промо (tank)',
      valueThb: promoTankThb,
      hint: 'Маркетинговый резерв, не долг партнёрам',
    },
  ];

  return {
    totalObligationsThb,
    cashAtRiskThb: round2(cash.summary?.cashAtRiskThb),
    rows,
    ownerNote:
      'Сумма «всего обязательств» — эскроу + готово к выплате + открытые пулы + рефералы. Promo tank показан отдельно.',
  };
}
