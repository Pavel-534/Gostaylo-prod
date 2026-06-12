/**
 * Stage 131.1 / 131.3 — public referral calculator (marketing-only; no owner waterfall leak).
 * FX doctrine: guest RUB payment shows retail total; ambassador bonuses always from base THB commission @ mid.
 */
import { SystemConfigService } from '@/lib/services/finance/system-config.service.js'
import { computeWaterfallPreview } from '@/lib/services/finance/fintech-waterfall.js'
import {
  getMidMarketDisplayRateMap,
  getStorefrontDisplayRateMap,
} from '@/lib/pricing/fx-display.js'
import { convertThbToDisplayAmountRounded } from '@/lib/pricing/fx-display-client.js'

/** ADR-131 launch preset for cross-currency guest payment display. */
const DEFAULT_FX_MARKUP_PCT = 3.5

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

function normalizeGuestPaymentMode(raw) {
  const v = String(raw || 'THB').trim().toUpperCase()
  if (v === 'RUB' || v === 'RUB_CROSS' || v === 'CROSS') return 'RUB_CROSS'
  return 'THB'
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
 * Settlement FX markup on guest payment (operational buffer — not in referral pool).
 * Formula: guestPayment × (pct / (100 + pct)) — same as ADR-131 §8.0.B.
 */
export function computeGuestCrossCurrencyFxMarkupThb(guestPaymentThb, fxMarkupPct = DEFAULT_FX_MARKUP_PCT) {
  const base = round2(Math.max(0, guestPaymentThb))
  const pct = Number(fxMarkupPct)
  if (!Number.isFinite(pct) || pct <= 0) {
    return { fxMarkupThb: 0, guestPaysTotalThb: base, fxMarkupPct: 0 }
  }
  const fxMarkupThb = round2(base * (pct / (100 + pct)))
  return {
    fxMarkupThb,
    guestPaysTotalThb: round2(base + fxMarkupThb),
    fxMarkupPct: pct,
  }
}

async function buildRubDisplayAmounts({ guestPaysTotalThb, l1Thb, l2Thb, refereeThb }) {
  const [midMap, retailMap] = await Promise.all([
    getMidMarketDisplayRateMap(),
    getStorefrontDisplayRateMap(),
  ])
  const guestPaysRub = convertThbToDisplayAmountRounded(guestPaysTotalThb, 'RUB', retailMap)
  const l1Rub = convertThbToDisplayAmountRounded(l1Thb, 'RUB', midMap)
  const l2Rub = convertThbToDisplayAmountRounded(l2Thb, 'RUB', midMap)
  const refereeRub = convertThbToDisplayAmountRounded(refereeThb, 'RUB', midMap)
  return {
    guestPaysRub,
    l1AmountRub: l1Rub,
    l2AmountRub: l2Rub,
    refereeAmountRub: refereeRub,
    midRateRubToThb: midMap?.RUB ?? null,
    retailRateRubToThb: retailMap?.RUB ?? null,
  }
}

/**
 * Marketing estimate for ambassadors — itemized waterfall internally; response omits owner-side costs.
 * @param {{ subtotalThb?: number, guestServiceFeePercent?: number, hostCommissionPercent?: number, fxMarkupThb?: number, guestPaymentMode?: string, fxMarkupPct?: number }} params
 */
export async function computePublicReferralCalculatorEstimate({
  subtotalThb = 35_000,
  guestServiceFeePercent = 15,
  hostCommissionPercent = 0,
  fxMarkupThb = 0,
  guestPaymentMode = 'THB',
  fxMarkupPct = DEFAULT_FX_MARKUP_PCT,
} = {}) {
  const config = await SystemConfigService.getFintechConfig()
  const subtotal = clampSubtotal(subtotalThb)
  const guestFee = clampGuestFeePercent(guestServiceFeePercent)
  const paymentMode = normalizeGuestPaymentMode(guestPaymentMode)

  // Bonuses always from base THB commission — FX markup excluded from referral pool (SSOT).
  const preview = computeWaterfallPreview(config, {
    subtotalThb: subtotal,
    guestServiceFeePercent: guestFee,
    hostCommissionPercent,
    fxMarkupThb: 0,
  })

  const split = splitPoolForMarketing(preview.referralPoolThb, config)
  const l2Enabled = config.ambassadorGuestL2Enabled === true

  const result = {
    subtotalThb: subtotal,
    guestServiceFeePercent: guestFee,
    guestPaymentMode: paymentMode,
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
    fxMarkupThb: 0,
    guestPaysTotalThb: preview.guestPaymentThb,
    bonusFxPolicy: 'mid_only',
    disclaimer:
      'Оценка до hold 7–14 дней и до вывода. Комиссия вывода 1.5% удерживается с получателя.',
    transparencyNote:
      'Мы берём на себя все сложности трансграничных платежей, конвертации и вывода средств хостам. Вы всегда получаете стабильный и предсказуемый заработок в THB (или эквивалент в RUB по рыночному курсу).',
  }

  if (paymentMode === 'RUB_CROSS') {
    const fx = computeGuestCrossCurrencyFxMarkupThb(preview.guestPaymentThb, fxMarkupPct)
    result.fxMarkupThb = fx.fxMarkupThb
    result.fxMarkupPct = fx.fxMarkupPct
    result.guestPaysTotalThb = fx.guestPaysTotalThb
    result.guestPaymentThb = preview.guestPaymentThb
    result.bonusFxPolicy = 'bonuses_from_base_thb_at_mid'

    try {
      const rub = await buildRubDisplayAmounts({
        guestPaysTotalThb: fx.guestPaysTotalThb,
        l1Thb: split.l1AmountThb,
        l2Thb: split.l2AmountThb,
        refereeThb: split.refereeAmountThb,
      })
      result.guestPaysRub = rub.guestPaysRub
      result.l1AmountRub = rub.l1AmountRub
      result.l2AmountRub = rub.l2AmountRub
      result.refereeAmountRub = rub.refereeAmountRub
      result.midRateRubToThb = rub.midRateRubToThb
      result.retailRateRubToThb = rub.retailRateRubToThb
    } catch (e) {
      result.fxDisplayWarning = e?.message || 'FX_RATES_UNAVAILABLE'
    }
  }

  return result
}

export default { computePublicReferralCalculatorEstimate, computeGuestCrossCurrencyFxMarkupThb }
