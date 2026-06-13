/**
 * Stage 131.3 / 134 — transparent referral withdrawal preview (ADR-131 §10).
 */
import { SystemConfigService } from '@/lib/services/finance/system-config.service.js'
import { convertReferralPayoutThbToCurrency } from '@/lib/services/marketing/referral-payout-fx.service.js'
import { assertReferralPayoutFxFresh } from '@/lib/finance/referral-payout-fx-policy.js'

function round2(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

/**
 * @param {number} grossThb — full withdrawable balance requested
 * @param {{ payoutCurrency?: string, feePercent?: number, skipFxConversion?: boolean, skipStaleGuard?: boolean }} [opts]
 */
export async function buildReferralWithdrawalPreview(grossThb, opts = {}) {
  const gross = round2(Math.max(0, grossThb))
  const config = await SystemConfigService.getFintechConfig()
  const feePercent = round2(
    opts.feePercent != null ? Number(opts.feePercent) : Number(config.referralWithdrawalFeePercent ?? 1.5),
  )
  const feeThb = round2((gross * feePercent) / 100)
  const netThb = round2(Math.max(0, gross - feeThb))
  const payoutCurrency = String(opts.payoutCurrency || 'RUB').trim().toUpperCase()

  const preview = {
    grossThb: gross,
    withdrawalFeePercent: feePercent,
    withdrawalFeeThb: feeThb,
    netThb,
    feePaidBy: 'beneficiary',
    payoutCurrency,
    netInPayoutCurrency: netThb,
    fxSpreadPct: 0,
    fxNote: 'Конвертация THB → RUB по рыночному mid-курсу без spread платформы.',
    disclaimer:
      'Мы берём небольшую прозрачную комиссию только на вывод, чтобы покрыть банковские расходы. Это стандартная практика и она уже заложена в настройках системы.',
  }

  if (opts.skipFxConversion || payoutCurrency === 'THB' || netThb <= 0) {
    return preview
  }

  if (!opts.skipStaleGuard) {
    await assertReferralPayoutFxFresh(payoutCurrency)
  }

  const fx = await convertReferralPayoutThbToCurrency(netThb, payoutCurrency)
  preview.netInPayoutCurrency = fx.amountInPayoutCurrency
  preview.midRateToThb = fx.midRateToThb
  preview.rubApproximate =
    payoutCurrency === 'RUB'
      ? `Получите примерно ${fx.amountInPayoutCurrency.toLocaleString('ru-RU')} ₽ по текущему рыночному курсу`
      : null

  return preview
}

export default { buildReferralWithdrawalPreview }
