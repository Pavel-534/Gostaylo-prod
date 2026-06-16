/**
 * Stage 124.9 — Excel (.xlsx) с формулами для Financial Intelligence.
 */
import { getSiteDisplayName } from '@/lib/site-url.js';
import * as XLSX from 'xlsx';
import { resolveAnalyticsPeriod } from '@/lib/analytics/core/period-resolver.js';
import {
  fetchBookingFinancialFacts,
  queryBookingFinancialFactsPage,
} from '@/lib/analytics/facts/booking-financial-fact.js';
import { buildExecutiveSummaryReport } from '@/lib/analytics/reports/executive-summary.report.js';
import { buildEscrowAgingReport } from '@/lib/analytics/reports/escrow-aging.block.js';
import buildBookingPlReport from '@/lib/analytics/reports/booking-pl-report.js';
import { round2 } from '@/lib/services/marketing/referral-calculation.js';

const REVENUE_STATUSES = [
  'PAID',
  'PAID_ESCROW',
  'CHECKED_IN',
  'THAWED',
  'READY_FOR_PAYOUT',
  'COMPLETED',
];

function cellNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? round2(n) : 0;
}

function toXlsxBuffer(wb) {
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function appendSheet(wb, name, aoa) {
  const safeName = name.slice(0, 31).replace(/[/\\?*[\]]/g, '_');
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, safeName);
}

/**
 * @param {{ periodPreset?: string, excludeTest?: boolean }} opts
 */
export async function exportPeriodSummaryXlsx(opts = {}) {
  const periodPreset = opts.periodPreset || '30d';
  const excludeTest = opts.excludeTest !== false;
  const report = await buildExecutiveSummaryReport({ periodPreset, excludeTest, skipCache: true });
  const profit = report.periodInsights?.profitSummary || {};
  const obligations = report.obligationsSummary || {};
  const jurisdiction = report.jurisdictionInsight || {};

  const wb = XLSX.utils.book_new();
  const siteName = getSiteDisplayName();
  const rows = [
    [`${siteName} — Financial Intelligence`, ''],
    ['Период', periodPreset],
    ['Сформировано', report.generatedAt || new Date().toISOString()],
    ['', ''],
    ['Показатель', 'THB', 'Примечание'],
    ['Оборот (GMV)', cellNum(profit.gmvThb), ''],
    ['Маржа платформы', cellNum(profit.platformMarginThb), ''],
    ['Пул маржи (ADR)', cellNum(profit.platformMarginPoolThb), ''],
    ['RU агентство', cellNum(profit.ruFeeThb), '~7% ADR-097'],
    ['KG сервис', cellNum(profit.krFeeThb), '~8% ADR-097'],
    ['FX в цене', cellNum(profit.fxMarkupThb), ''],
    ['Рефералы', cellNum(profit.referralOutflowThb), ''],
    ['Страховой резерв', cellNum(profit.insuranceReserveThb), 'settlement_v3'],
    ['FX казна (30д)', cellNum(profit.treasuryFxCostThb), ''],
    ['Чистая после рефералов', cellNum(profit.netProfitThb), ''],
    ['Чистая прибыль платформы', cellNum(profit.netProfitAfterAllThb), 'B7-B9:B14'],
    ['', ''],
    ['Броней в периоде', cellNum(profit.bookingsCount), ''],
    ['', ''],
    ['Обязательства', 'THB', ''],
    ['Всего обязательств', cellNum(obligations.totalObligationsThb), ''],
    ['В эскроу', cellNum(report.escrowPipeline?.partnerLiabilityThb), ''],
    ['Реферальный долг', cellNum(obligations.rows?.find((r) => r.id === 'referral')?.valueThb), ''],
    ['Promo tank', cellNum(obligations.rows?.find((r) => r.id === 'promo')?.valueThb), ''],
    ['', ''],
    ['Юрисдикции (пул)', cellNum(jurisdiction.poolTotalThb), jurisdiction.ownerNote || ''],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  if (ws.B16) {
    ws.B16 = { f: 'B7-B9-B10-B11-B12-B13-B14', t: 'n' };
  }
  XLSX.utils.book_append_sheet(wb, ws, 'Сводка');

  const periods = resolveAnalyticsPeriod(periodPreset);
  const filename = `fi-summary-${periodPreset}-${periods.current.fromIso.slice(0, 10)}.xlsx`;
  return { buffer: toXlsxBuffer(wb), filename, sheetCount: 1 };
}

/**
 * @param {{ periodPreset?: string, excludeTest?: boolean }} opts
 */
export async function exportBookingsPlXlsx(opts = {}) {
  const periods = resolveAnalyticsPeriod(opts.periodPreset || '30d');
  const excludeTest = opts.excludeTest !== false;
  const facts = await fetchBookingFinancialFacts({
    fromIso: periods.current.fromIso,
    toIso: periods.current.toIso,
    excludeTest,
    statuses: REVENUE_STATUSES,
    limit: 10000,
  });

  const headers = [
    'booking_id',
    'status',
    'category',
    'subtotal_thb',
    'guest_payable_thb',
    'platform_margin_thb',
    'ru_fee_thb',
    'kg_fee_thb',
    'fx_markup_thb',
    'referral',
    'partner_payout_thb',
    'insurance_reserve_thb',
    'net_after_all_thb',
  ];

  const dataRows = [];
  for (const f of facts) {
    const jurisdiction = round2((f.ruFeeThb || 0) + (f.krFeeThb || 0) + (f.fxMarkupThb || 0));
    let referralCost = 0;
    try {
      const pl = await buildBookingPlReport(f.bookingId);
      if (pl.success) referralCost = pl.data?.pl?.referralCostThb || 0;
    } catch {
      referralCost = 0;
    }
    const netAfterAll = round2(
      (f.platformMarginThb || 0) - referralCost - jurisdiction - (f.insuranceReserveThb || 0),
    );
    dataRows.push([
      f.bookingId,
      f.status,
      f.categorySlug || '',
      cellNum(f.subtotalThb),
      cellNum(f.guestBruttoThb || f.guestPayableThb),
      cellNum(f.platformMarginThb),
      cellNum(f.ruFeeThb),
      cellNum(f.krFeeThb),
      cellNum(f.fxMarkupThb),
      f.hasReferralAttribution ? 1 : 0,
      cellNum(f.partnerPayoutThb),
      cellNum(f.insuranceReserveThb),
      netAfterAll,
    ]);
  }

  const startRow = 2;
  const endRow = startRow + dataRows.length - 1;
  const aoa = [headers, ...dataRows];
  if (dataRows.length > 0) {
    aoa.push([
      'ИТОГО',
      '',
      '',
      { f: `SUM(D${startRow}:D${endRow})` },
      { f: `SUM(E${startRow}:E${endRow})` },
      { f: `SUM(F${startRow}:F${endRow})` },
      { f: `SUM(G${startRow}:G${endRow})` },
      { f: `SUM(H${startRow}:H${endRow})` },
      { f: `SUM(I${startRow}:I${endRow})` },
      '',
      { f: `SUM(K${startRow}:K${endRow})` },
      { f: `SUM(L${startRow}:L${endRow})` },
      { f: `SUM(M${startRow}:M${endRow})` },
    ]);
  }

  const wb = XLSX.utils.book_new();
  appendSheet(wb, 'Брони P&L', aoa);
  const filename = `fi-bookings-pl-${periods.preset}-${periods.current.fromIso.slice(0, 10)}.xlsx`;
  return { buffer: toXlsxBuffer(wb), filename, rowCount: dataRows.length };
}

/**
 * @param {{ excludeTest?: boolean, minDays?: number }} opts
 */
export async function exportEscrowAgingXlsx(opts = {}) {
  const excludeTest = opts.excludeTest !== false;
  const minDays = Number(opts.minDays) || 7;
  const aging = await buildEscrowAgingReport({ excludeTest });
  const page = await queryBookingFinancialFactsPage({
    pipelineOnly: true,
    escrowAgingMinDays: minDays,
    excludeTest,
    page: 1,
    pageSize: 5000,
  });

  const headers = ['booking_id', 'status', 'partner_net_thb', 'age_days', 'partner_id'];
  const dataRows = (page.rows || []).map((f) => [
    f.bookingId,
    f.status,
    cellNum(f.partnerPayoutThb),
    f.pipelineAgeDays ?? '',
    f.partnerId || '',
  ]);

  const startRow = 2;
  const endRow = startRow + Math.max(0, dataRows.length - 1);
  const summaryRows = [
    ['Escrow Aging', ''],
    ['Порог (дней)', minDays],
    ['', ''],
    ['Корзина', 'Кол-во', 'Сумма THB'],
    ...(aging.buckets || []).map((b) => [b.label, b.count, cellNum(b.partnerNetThb)]),
    ['', ''],
    ['Детализация', '', '', '', ''],
    headers,
    ...dataRows,
  ];

  if (dataRows.length > 0) {
    summaryRows.push([
      'ИТОГО',
      '',
      { f: `SUM(C${startRow + 6}:C${endRow + 6})` },
      '',
      '',
    ]);
  }

  const wb = XLSX.utils.book_new();
  appendSheet(wb, 'Escrow Aging', summaryRows);
  const filename = `fi-escrow-aging-${minDays}d.xlsx`;
  return { buffer: toXlsxBuffer(wb), filename, rowCount: dataRows.length };
}
