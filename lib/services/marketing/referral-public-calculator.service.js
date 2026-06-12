/**
 * Stage 131.1 — public referral calculator (marketing-only; no owner waterfall leak).
 */
import { SystemConfigService } from '@/lib/services/finance/system-config.service.js'
import { computeWaterfallPreview } from '@/lib/services/finance/fintech-waterfall.js'

function round2(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

function clampSubtotal(raw) {
  const n = Number(raw)
  if (!Number.isFinite(n)) return 35_000
  return round2(Math.min(10_000_000, Math.max(500, n)))
}

function clampGuestFeePercent(raw) {
  const n = Number(raw)
  if (!Number.isFinite(n)) return 15
  return round2(Math.min(30, Math.max(0, n)))
}

function splitPoolForMarketing(poolThb, config) {
  const pool = round2(Math.max(0, poolThb))
  const l1Pct = Number(config.ambassadorGuestPoolL1Percent ?? 45)
  const l2Pct = Number(config.ambassadorGuestPoolL2Percent ?? 12)
  const l1 = round2((pool * l1Pct) / 100)
  const l2 = round2((pool * l2Pct) / 100)
  const guest = round2(pool - l1 - l2)
  return { l1AmountThb: l1, l2AmountThb: l2, refereeAmountThb: guest }
}

/**
 * Marketing estimate for ambassadors — itemized waterfall internally; response omits owner-side costs.
 */
export async function computePublicReferralCalculatorEstimate({
  subtotalThb = 35_000,
  guestServiceFeePercent = 15,
  hostCommissionPercent = 0,
  fxMarkupThb = 0,
} = {}) {
  const config = await SystemConfigService.getFintechConfig()
  const subtotal = clampSubtotal(subtotalThb)
  const guestFee = clampGuestFeePercent(guestServiceFeePercent)
  const preview = computeWaterfallPreview(config, {
    subtotalThb: subtotal,
    guestServiceFeePercent: guestFee,
    hostCommissionPercent,
    fxMarkupThb: round2(Math.max(0, fxMarkupThb)),
  })

  const split = splitPoolForMarketing(preview.referralPoolThb, config)
  const l2Enabled = config.ambassadorGuestL2Enabled === true

  return {
    subtotalThb: subtotal,
    guestServiceFeePercent: guestFee,
    guestPaymentThb: preview.guestPaymentThb,
    l1AmountThb: split.l1AmountThb,
    l2AmountThb: split.l2AmountThb,
    refereeAmountThb: split.refereeAmountThb,
    l2LiveEnabled: l2Enabled,
    l2ShownAs: l2Enabled ? 'live' : 'preview',
    splitPercents: {
      l1: config.ambassadorGuestPoolL1Percent,
      l2: config.ambassadorGuestPoolL2Percent,
      referee: config.ambassadorGuestPoolRefereePercent,
    },
    disclaimer:
      'Оценка до hold 7–14 дней и до вывода. Комиссия вывода 1.5% удерживается с получателя.',
  }
}

export default { computePublicReferralCalculatorEstimate }
