/**
 * Stage 124.12 — CSV / Excel export for Referral ROI dashboard.
 */
import * as XLSX from 'xlsx';
import buildReferralRoiReport from '@/lib/analytics/reports/referral-roi.report.js';

export const REFERRAL_ROI_CSV_DELIMITER = ';';

const CAMPAIGN_COLUMNS = [
  'campaign_slug',
  'campaign_name',
  'roi',
  'cac_thb',
  'spend_period_thb',
  'commission_thb',
  'net_effect_thb',
  'clawback_thb',
  'guests_acquired',
  'ltv_thb',
  'max_budget_thb',
  'lifetime_spent_thb',
  'budget_usage_pct',
  'budget_alert',
  'clicks',
  'signups',
];

function escapeCsvCell(value) {
  const s = value == null ? '' : String(value);
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatPeriodLabel(period) {
  const cur = period?.current;
  if (!cur?.fromIso) return 'period';
  return `${String(cur.fromIso).slice(0, 10)}_${String(cur.toIso).slice(0, 10)}`;
}

/**
 * @param {Record<string, unknown>} report
 */
export function buildReferralRoiCampaignCsv(report) {
  const lines = [];
  lines.push(`# GoStayLo Referral ROI — кампании`);
  lines.push(`# Период: ${formatPeriodLabel(report.period)}`);
  lines.push(`# Сформировано: ${report.generatedAt || new Date().toISOString()}`);
  lines.push('');
  lines.push(CAMPAIGN_COLUMNS.join(REFERRAL_ROI_CSV_DELIMITER));

  for (const row of report.campaigns || []) {
    lines.push(
      [
        row.campaignSlug,
        row.campaignName || row.campaignSlug,
        row.roiIndex != null ? row.roiIndex : '',
        row.cacThb != null ? row.cacThb : '',
        row.spendThb ?? 0,
        row.commissionThb ?? 0,
        row.netEffectThb ?? 0,
        row.clawbackThb ?? 0,
        row.guestsAcquired ?? row.firstBookingsCount ?? 0,
        row.ltvThb != null ? row.ltvThb : '',
        row.maxBudgetThb != null ? row.maxBudgetThb : '',
        row.lifetimeSpentThb ?? '',
        row.budgetUsagePct != null ? row.budgetUsagePct : '',
        row.budgetAlertLevel || '',
        row.clicksCount ?? 0,
        row.signupsCount ?? 0,
      ]
        .map(escapeCsvCell)
        .join(REFERRAL_ROI_CSV_DELIMITER),
    );
  }

  lines.push('');
  lines.push('# summary');
  const o = report.cacSummary?.overall || {};
  lines.push(['metric', 'value'].map(escapeCsvCell).join(REFERRAL_ROI_CSV_DELIMITER));
  for (const [k, v] of [
    ['overall_cac_thb', o.cacThb ?? ''],
    ['overall_roi', o.roiIndex ?? ''],
    ['guests_acquired', o.guestsAcquired ?? 0],
    ['spend_thb', o.spendThb ?? 0],
    ['commission_thb', o.commissionThb ?? 0],
    ['net_margin_thb', report.overall?.netMarginThb ?? ''],
  ]) {
    lines.push([k, v].map(escapeCsvCell).join(REFERRAL_ROI_CSV_DELIMITER));
  }

  return lines.join('\n');
}

/**
 * @param {{ periodPreset?: string }} opts
 */
export async function exportReferralRoiCsv(opts = {}) {
  const report = await buildReferralRoiReport({
    periodPreset: opts.periodPreset || '30d',
    skipCache: true,
  });
  const csv = buildReferralRoiCampaignCsv(report);
  const filename = `referral-roi-${opts.periodPreset || '30d'}-${formatPeriodLabel(report.period)}.csv`;
  return {
    csv,
    filename,
    rowCount: (report.campaigns || []).length,
    report,
  };
}

/**
 * @param {Record<string, unknown>} report
 */
export function buildReferralRoiXlsxBuffer(report) {
  const wb = XLSX.utils.book_new();
  const periodLabel = formatPeriodLabel(report.period);
  const o = report.cacSummary?.overall || {};

  const summaryRows = [
    ['GoStayLo — Referral ROI'],
    ['Период', periodLabel],
    ['Сформировано', report.generatedAt || new Date().toISOString()],
    [''],
    ['Показатель', 'Значение'],
    ['ROI программы', o.roiIndex ?? ''],
    ['CAC (средний)', o.cacThb ?? ''],
    ['Привлечено гостей', o.guestsAcquired ?? 0],
    ['Расход promo', o.spendThb ?? 0],
    ['Комиссия', o.commissionThb ?? 0],
    ['Net-маржа', report.overall?.netMarginThb ?? ''],
    ['Promo tank (остаток)', report.overall?.promoTankBalanceThb ?? ''],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Сводка');

  const campaignHeader = [
    'Кампания',
    'Название',
    'ROI',
    'CAC',
    'Расход (период)',
    'Комиссия',
    'Net effect',
    'Clawback',
    'Гости',
    'LTV',
    'Бюджет',
    'Потрачено (lifetime)',
    '% бюджета',
    'Алерт',
    'Клики',
    'Регистрации',
  ];
  const campaignRows = (report.campaigns || []).map((row) => [
    row.campaignSlug,
    row.campaignName || row.campaignSlug,
    row.roiIndex ?? '',
    row.cacThb ?? '',
    row.spendThb ?? 0,
    row.commissionThb ?? 0,
    row.netEffectThb ?? 0,
    row.clawbackThb ?? 0,
    row.guestsAcquired ?? row.firstBookingsCount ?? 0,
    row.ltvThb ?? '',
    row.maxBudgetThb ?? '',
    row.lifetimeSpentThb ?? '',
    row.budgetUsagePct ?? '',
    row.budgetAlertLevel || '',
    row.clicksCount ?? 0,
    row.signupsCount ?? 0,
  ]);
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([campaignHeader, ...campaignRows]),
    'Кампании',
  );

  const sourceHeader = ['Источник', 'CAC', 'ROI', 'Гости', 'Расход', 'Комиссия'];
  const sourceRows = (report.cacSummary?.bySource || []).map((row) => [
    row.label,
    row.cacThb ?? '',
    row.roiIndex ?? '',
    row.guestsAcquired ?? 0,
    row.spendThb ?? 0,
    row.commissionThb ?? 0,
  ]);
  if (sourceRows.length) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([sourceHeader, ...sourceRows]),
      'Источники',
    );
  }

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}

/**
 * @param {{ periodPreset?: string }} opts
 */
export async function exportReferralRoiXlsx(opts = {}) {
  const report = await buildReferralRoiReport({
    periodPreset: opts.periodPreset || '30d',
    skipCache: true,
  });
  const buffer = buildReferralRoiXlsxBuffer(report);
  const filename = `referral-roi-${opts.periodPreset || '30d'}-${formatPeriodLabel(report.period)}.xlsx`;
  return {
    buffer,
    filename,
    rowCount: (report.campaigns || []).length,
    report,
  };
}
