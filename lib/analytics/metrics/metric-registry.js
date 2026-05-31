/**
 * Stage 124.4 — реестр метрик Financial Intelligence (формулы + подсказки).
 * Math SSOT: booking facts + FinancialReportingService + referral accounting snapshot.
 */

/** @typedef {{ id: string, label: string, hint: string, formula: string, unit: 'thb' | 'count' | 'ratio' | 'pct' }} MetricDefinition */

/** @type {MetricDefinition[]} */
export const METRIC_REGISTRY = Object.freeze([
  {
    id: 'gmvThb',
    label: 'GMV (subtotal)',
    ownerLabel: 'Оборот (тариф)',
    hint: 'Сумма tariff subtotal по оплаченным броням за период (price_thb из snapshot).',
    formula: 'Σ subtotalThb по booking facts',
    unit: 'thb',
  },
  {
    id: 'guestPayableThb',
    label: 'Brutto гостя',
    ownerLabel: 'Оплата гостей',
    hint: 'Сколько заплатил гость в THB-эквиваленте (rounded guest total).',
    formula: 'Σ guestBruttoThb / guestPayableThb',
    unit: 'thb',
  },
  {
    id: 'platformMarginThb',
    label: 'Platform margin',
    ownerLabel: 'Маржа платформы',
    hint: 'Guest service fee + host commission (или settlement_v3.platform_margin).',
    formula: 'Σ platformMarginThb',
    unit: 'thb',
  },
  {
    id: 'ruFeeThb',
    label: 'RU agency share',
    hint: 'Доля агентства из pricing_snapshot v2 (ru_fee_thb). Только v2 bookings.',
    formula: 'Σ final_breakdown.ru_fee_thb',
    unit: 'thb',
  },
  {
    id: 'krFeeThb',
    label: 'KG service share',
    hint: 'Доля сервисной компании из pricing_snapshot v2 (kr_fee_thb).',
    formula: 'Σ final_breakdown.kr_fee_thb',
    unit: 'thb',
  },
  {
    id: 'fxMarkupThb',
    label: 'FX markup',
    hint: 'Внутренний FX-spread в THB (fx_markup_thb из v2 snapshot).',
    formula: 'Σ fx_markup_thb',
    unit: 'thb',
  },
  {
    id: 'partnerPayoutThb',
    label: 'Partner net (period)',
    hint: 'Netto партнёра по броням, созданным в периоде.',
    formula: 'Σ partnerPayoutThb',
    unit: 'thb',
  },
  {
    id: 'partnerLiabilityThb',
    label: 'Partner liability (live)',
    ownerLabel: 'Долг партнёрам (эскроу)',
    hint: 'Сумма partner_earnings по броням в эскроу-пайплайне (не period-scoped).',
    formula: 'Σ partner_earnings_thb WHERE status ∈ pipeline',
    unit: 'thb',
  },
  {
    id: 'referralLiabilityThb',
    label: 'Referral obligation',
    ownerLabel: 'Обязательства по рефералам',
    hint: 'Earned минус withdrawn минус canceled (loadReferralAccountingSnapshot).',
    formula: 'accounting.currentLiabilityThb',
    unit: 'thb',
  },
  {
    id: 'promoTankBalanceThb',
    label: 'Promo tank',
    ownerLabel: 'Резерв промо',
    hint: 'Текущий остаток marketing promo pot.',
    formula: 'ReferralPromoTankService.getCurrentBalance()',
    unit: 'thb',
  },
  {
    id: 'referralRoiIndex',
    label: 'Referral ROI',
    hint: 'Комиссия с реферальных броней / earned bonuses за период.',
    formula: 'FinancialReportingService.computeRoi',
    unit: 'ratio',
  },
  {
    id: 'netReferralMarginThb',
    label: 'Net referral margin',
    hint: 'Commission − bonuses − clawback за период (site-wide referral economics).',
    formula: 'FinancialReportingService.computeMargins',
    unit: 'thb',
  },
  {
    id: 'escrowPipelineCount',
    label: 'Escrow pipeline',
    hint: 'Количество броней по статусам PAID_ESCROW / THAWED / READY_FOR_PAYOUT.',
    formula: 'COUNT bookings GROUP BY status',
    unit: 'count',
  },
]);

/**
 * @param {string} id
 * @returns {MetricDefinition | undefined}
 */
export function getMetricDefinition(id) {
  return METRIC_REGISTRY.find((m) => m.id === id);
}

/**
 * @param {string[]} ids
 */
export function pickMetricDefinitions(ids) {
  return ids.map((id) => getMetricDefinition(id)).filter(Boolean);
}
