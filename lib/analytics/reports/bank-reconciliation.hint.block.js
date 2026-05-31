/**
 * Stage 124.9 — подсказки для сверки с банком / USDT (GL read-only).
 */
import { round2 } from '@/lib/services/marketing/referral-calculation.js';

/**
 * @param {{
 *   reconciliation?: {
 *     guestClearingDebitsThb?: number,
 *     distributionCreditsThb?: number,
 *     deltaThb?: number,
 *     marginLeakage?: boolean,
 *     cashAccountLabel?: string,
 *   } | null,
 *   cashPosition?: { summary?: { cashAtRiskThb?: number } },
 * }} input
 */
export function buildBankReconciliationHint(input) {
  const recon = input.reconciliation || {};
  const glGuestClearingThb = round2(recon.guestClearingDebitsThb);
  const glDistributionThb = round2(recon.distributionCreditsThb);
  const ledgerDeltaThb = round2(recon.deltaThb);
  const cashAtRiskThb = round2(input.cashPosition?.summary?.cashAtRiskThb);

  const glReferenceThb = glGuestClearingThb;

  return {
    glGuestClearingThb,
    glDistributionThb,
    ledgerDeltaThb,
    marginLeakage: Boolean(recon.marginLeakage),
    glReferenceThb,
    cashAtRiskThb,
    cashAccountLabel:
      recon.cashAccountLabel ||
      'GUEST_PAYMENT_CLEARING — проход гостевых оплат через GL',
    ownerNote:
      'Введите остаток и нажмите «Сохранить» — запись попадёт в историю сверок. Расхождение с GL помогает найти «зависшие» обязательства.',
  };
}
