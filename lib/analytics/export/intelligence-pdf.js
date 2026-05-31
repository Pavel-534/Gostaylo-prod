/**
 * Stage 124.8 — PDF export SSOT for Financial Intelligence (pdfkit + Noto).
 */
import { createPartnerPdfDocument, drawPdfUnicodeLine } from '@/lib/services/partner-pdf-fonts.js';
import { getSiteDisplayName } from '@/lib/site-url.js';
import buildExecutiveSummaryReport from '@/lib/analytics/reports/executive-summary.report.js';
import buildBookingPlReport from '@/lib/analytics/reports/booking-pl-report.js';

function fmtThb(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return `฿${x.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}`;
}

function fmtPct(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const v = Number(n);
  return `${v > 0 ? '+' : ''}${v.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%`;
}

/**
 * @param {import('pdfkit').PDFDocument} doc
 * @param {string} font
 * @param {string} text
 * @param {number} [fontSize]
 */
function line(doc, font, text, fontSize = 10) {
  const y = doc.y;
  drawPdfUnicodeLine(doc, text, 48, y, { fontSize });
  doc.y = y + (fontSize + 4);
}

/**
 * @param {string} bookingId
 */
export async function renderBookingPlPdf(bookingId) {
  const result = await buildBookingPlReport(bookingId);
  if (!result.success) {
    throw new Error(result.error || 'BOOKING_PL_FAILED');
  }
  const report = result.data;
  const pl = report.pl || {};
  const siteName = getSiteDisplayName();

  return new Promise((resolve, reject) => {
    const { doc, font: headerFont } = createPartnerPdfDocument({ margin: 48, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), filename: `pl-booking-${String(bookingId).slice(0, 12)}.pdf` }));
    doc.on('error', reject);

    doc.fillColor('#111111').font(headerFont).fontSize(16).text(`${siteName} — P&L бронирования`, { underline: true });
    doc.moveDown(0.3);
    line(doc, headerFont, `Бронь: ${bookingId}`, 9);
    line(doc, headerFont, `Статус: ${report.fact?.status || '—'} · Категория: ${report.fact?.categorySlug || '—'}`, 9);
    line(doc, headerFont, `Сформировано: ${new Date(report.generatedAt || Date.now()).toLocaleString('ru-RU')}`, 9);
    doc.moveDown(0.6);

    doc.font(headerFont).fontSize(12).fillColor('#059669').text('Итоговая маржа платформы');
    doc.fontSize(14).text(fmtThb(pl.netPlatformMarginThb), { continued: false });
    doc.moveDown(0.4);
    doc.fontSize(10).fillColor('#333333');
    line(doc, headerFont, `Оплата гостя: ${fmtThb(report.guest?.guestPayableThb)}`);
    line(doc, headerFont, `Оборот (тариф): ${fmtThb(report.fact?.subtotalThb)}`);
    line(doc, headerFont, `Маржа брутто: ${fmtThb(pl.platformGrossMarginThb)}`);
    line(doc, headerFont, `Расход на реферал: ${fmtThb(pl.referralCostThb)}`);
    line(doc, headerFont, `Выплата партнёру: ${fmtThb(pl.partnerPayoutThb)}`);
    doc.moveDown(0.5);

    doc.font(headerFont).fontSize(11).fillColor('#111111').text('Разбивка RU / KG / FX');
    doc.fontSize(9).fillColor('#333333');
    line(doc, headerFont, `RU agency: ${fmtThb(report.jurisdiction?.ruFeeThb)}`);
    line(doc, headerFont, `KG service: ${fmtThb(report.jurisdiction?.krFeeThb)}`);
    line(doc, headerFont, `FX markup: ${fmtThb(report.jurisdiction?.fxMarkupThb)}`);
    doc.moveDown(0.5);

    if ((report.referral?.rows || []).length > 0) {
      doc.font(headerFont).fontSize(11).text('Реферальные строки');
      doc.fontSize(8);
      for (const r of report.referral.rows) {
        line(doc, headerFont, `${r.txType} · ${r.status} · ${fmtThb(r.amountThb)}`, 8);
      }
      doc.moveDown(0.3);
    }

    if ((report.ledger?.legs || []).length > 0) {
      doc.font(headerFont).fontSize(11).text('Проводки ledger');
      doc.fontSize(8);
      for (const leg of report.ledger.legs.slice(0, 24)) {
        line(
          doc,
          headerFont,
          `${leg.side} · ${leg.accountCode || leg.accountName || '—'} · THB ${leg.amountThb}`,
          8,
        );
      }
    }

    doc.moveDown(0.8);
    doc.fontSize(8).fillColor('#666666').text(
      'Документ сформирован из read-only аналитики GoStayLo (lib/analytics). Для бухучёта сверьте с ledger и актами.',
      { width: 500 },
    );
    doc.end();
  });
}

/**
 * @param {{ periodPreset?: string, excludeTest?: boolean }} opts
 */
export async function renderPeriodSummaryPdf(opts = {}) {
  const report = await buildExecutiveSummaryReport({
    periodPreset: opts.periodPreset || '30d',
    excludeTest: opts.excludeTest !== false,
    skipCache: true,
  });

  const profit = report.periodInsights?.profitSummary || {};
  const period = report.period?.current;
  const siteName = getSiteDisplayName();
  const preset = opts.periodPreset || '30d';

  return new Promise((resolve, reject) => {
    const { doc, font: headerFont } = createPartnerPdfDocument({ margin: 48, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () =>
      resolve({
        buffer: Buffer.concat(chunks),
        filename: `financial-intelligence-${preset}-${new Date().toISOString().slice(0, 10)}.pdf`,
      }),
    );
    doc.on('error', reject);

    doc.fillColor('#111111').font(headerFont).fontSize(16).text(`${siteName} — Финансовая сводка`, { underline: true });
    doc.moveDown(0.3);
    line(doc, headerFont, `Период: ${period?.label || preset}`, 10);
    line(doc, headerFont, `С ${period?.fromIso?.slice(0, 10) || '—'} по ${period?.toIso?.slice(0, 10) || '—'}`, 9);
    line(doc, headerFont, `Сформировано: ${new Date(report.generatedAt).toLocaleString('ru-RU')}`, 9);
    doc.moveDown(0.6);

    doc.font(headerFont).fontSize(12).fillColor('#059669').text('Итоговая прибыль платформы (после рефералов)');
    doc.fontSize(16).text(fmtThb(profit.netProfitThb));
    doc.moveDown(0.4);
    doc.fontSize(10).fillColor('#333333');
    line(doc, headerFont, `Оборот (тариф): ${fmtThb(profit.gmvThb)} · ${profit.bookingsCount || 0} броней`);
    line(doc, headerFont, `Маржа платформы: ${fmtThb(profit.platformMarginThb)} (${fmtPct(profit.vsPrevious?.marginDeltaPct)} к пред. периоду)`);
    line(doc, headerFont, `Расход на рефералы: ${fmtThb(profit.referralOutflowThb)}`);
    line(doc, headerFont, `Выплаты партнёрам (период): ${fmtThb(profit.partnerPayoutThb)}`);
    doc.moveDown(0.5);

    const j = report.jurisdictionInsight || report.jurisdictionSplit || {};
    doc.font(headerFont).fontSize(11).fillColor('#111111').text('RU / KG / FX');
    doc.fontSize(9).fillColor('#333333');
    line(doc, headerFont, `RU: ${fmtThb(j.ruFeeThb)} · KG: ${fmtThb(j.krFeeThb)} · FX в цене: ${fmtThb(j.fxMarkupThb)}`);
    if (j.treasuryFxCostThb > 0) {
      line(doc, headerFont, `FX казна (30 дн.): ${fmtThb(j.treasuryFxCostThb)}`);
    }

    doc.moveDown(0.5);
    doc.font(headerFont).fontSize(11).text('Сейчас на платформе');
    doc.fontSize(9);
    const escrow = report.escrowPipeline || {};
    const cash = report.cashPosition || {};
    line(doc, headerFont, `В эскроу: ${escrow.totalInPipeline || 0} броней · долг партнёрам ${fmtThb(escrow.partnerLiabilityThb)}`);
    line(doc, headerFont, `К выплате: ${fmtThb(cash.readyToPay?.totalReadyThb)} (${cash.readyToPay?.totalReadyCount || 0} броней)`);
    line(doc, headerFont, `Реферальный долг: ${fmtThb(report.referral?.liability?.currentLiabilityThb)}`);
    line(doc, headerFont, `Резерв промо: ${fmtThb(report.referral?.liability?.promoTankBalanceThb)}`);

    if ((report.alerts || []).length > 0) {
      doc.moveDown(0.5);
      doc.font(headerFont).fontSize(11).text('Алерты');
      doc.fontSize(9);
      for (const a of report.alerts.slice(0, 6)) {
        line(doc, headerFont, `• ${a.title}: ${a.message}`, 8);
      }
    }

    doc.moveDown(0.8);
    doc.fontSize(8).fillColor('#666666').text(
      'Сводка read-only из lib/analytics. Не изменяет платежи и ledger. Для операций — FinTech-пульт.',
      { width: 500 },
    );
    doc.end();
  });
}
