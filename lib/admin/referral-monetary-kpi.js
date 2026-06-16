/**
 * Stage 120.6 — KPI labels & formulas for «Рефералка & Деньги» admin dashboard.
 * SSOT for tooltip copy; metrics math lives in lib/finance/reporting.service.js.
 */

export const REFERRAL_PERIOD_PRESETS = [
  { id: '7d', label: '7 дней', days: 7 },
  { id: '30d', label: '30 дней', days: 30 },
  { id: '90d', label: '90 дней', days: 90 },
  { id: 'all', label: 'Всё время', from: '2024-01-01' },
];

/** @param {{ id: string, days?: number, from?: string }} preset */
export function datesForReferralPreset(preset) {
  const to = new Date().toISOString().slice(0, 10);
  if (preset.from) return { dateFrom: preset.from, dateTo: to };
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - (preset.days || 30));
  return { dateFrom: d.toISOString().slice(0, 10), dateTo: to };
}

export const REFERRAL_KPI_DEFINITIONS = [
  {
    key: 'heldReferralThb',
    label: 'В холде',
    hint: 'Бонусы в статусе earned_held — начислены, но ещё не зачислены на кошелёк (защита от chargeback).',
    formula: 'Σ amount_thb WHERE status = earned_held (live)',
  },
  {
    key: 'promoTankSpendThb',
    label: 'Расход promo tank',
    hint: 'Сумма earned-бонусов из referral_ledger за период (referrer + referee cashback).',
    formula: 'Σ amount_thb WHERE status = earned',
  },
  {
    key: 'promoTankBalanceThb',
    label: 'Остаток promo tank',
    hint: 'Текущий баланс marketing promo pot из system_settings (live).',
    formula: 'ReferralPromoTankService.getCurrentBalance()',
    subKey: 'promoTankSpentPct',
    subLabel: 'Доля расхода',
    subFormula: 'расход / (расход + остаток) × 100%',
  },
  {
    key: 'referredCommissionThb',
    label: 'Комиссия платформы',
    hint: 'Комиссия платформы с броней, связанных с реферальной воронкой за период.',
    formula: 'Σ bookings.commission_thb по броням с ledger/атрибуцией',
  },
  {
    key: 'grossMarginThb',
    label: 'Gross-маржа',
    hint: 'Прибыль до учёта возвратов бонусов (clawback).',
    formula: 'комиссия − расход promo tank',
    signed: true,
  },
  {
    key: 'netMarginThb',
    label: 'Net-маржа',
    hint: 'Реальная маржа после отмен броней и clawback.',
    formula: 'gross − clawback',
    signed: true,
    subKey: 'clawbackThb',
    subLabel: 'Clawback',
    subFormula: 'Σ amount_thb WHERE status ∈ {canceled, canceled_deficit}',
  },
  {
    key: 'roiIndex',
    label: 'ROI рефералки',
    hint: 'На каждый 1 THB бонусов — сколько THB комиссии принесла программа.',
    formula: 'комиссия / расход promo tank (n/a если расход = 0)',
    format: 'roi',
  },
  {
    key: 'avgEarnedPerReferralThb',
    label: 'Средний бонус / реферал',
    hint: 'Средний earned на одного привлечённого пользователя с начислением.',
    formula: 'расход promo tank / уникальные referee с earned',
  },
  {
    key: 'suspiciousConversionsCount',
    label: 'Suspicious конверсии',
    hint: 'Конверсии, отмеченные anti-fraud v2 как подозрительные.',
    formula: 'COUNT(referral_attributions WHERE metadata.fraud_suspicious = true)',
    format: 'number',
    subKey: 'suspiciousConversionPct',
    subLabel: 'Доля suspicious',
  },
  {
    key: 'profitableReferrersCount',
    label: 'Окупившиеся рефереры',
    hint: 'Рефереры с положительной net-маржой за выбранный период.',
    formula: 'COUNT(referrer WHERE net_margin > 0)',
    format: 'ratio',
  },
];

/** @param {number|null|undefined} value */
export function marginToneClass(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return 'text-slate-600 tabular-nums';
  return n > 0
    ? 'text-emerald-700 font-semibold tabular-nums'
    : 'text-rose-600 font-semibold tabular-nums';
}

/** @param {number|null|undefined} roiIndex */
export function roiToneClass(roiIndex) {
  if (roiIndex == null || !Number.isFinite(Number(roiIndex))) {
    return 'text-slate-500 tabular-nums';
  }
  const n = Number(roiIndex);
  if (n >= 1) return 'text-emerald-700 font-semibold tabular-nums';
  if (n >= 0.5) return 'text-amber-600 font-medium tabular-nums';
  return 'text-rose-600 font-semibold tabular-nums';
}

export function marginBgClass(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'bg-slate-50 border-slate-200';
  if (n > 0) return 'bg-emerald-50/80 border-emerald-200/80';
  if (n < 0) return 'bg-rose-50/80 border-rose-200/80';
  return 'bg-slate-50 border-slate-200';
}
