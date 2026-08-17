/**
 * Partner financial statement PDF (Stage 46.0) — rows built via read-model SSOT.
 */

import fs from 'node:fs'
import path from 'node:path'
import { getSiteDisplayName } from '@/lib/site-url.js'
import { buildBookingFinancialSnapshotFromRow } from '@/lib/services/booking-financial-read-model.service'
import { createPartnerPdfDocument, drawPdfUnicodeLine } from '@/lib/services/partner-pdf-fonts'

function round2(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(x * 100) / 100
}

function axisFilterLabel(axis) {
  return axis === 'checkout'
    ? 'booking check_out (order end)'
    : 'booking created_at'
}

/**
 * @param {{
 *   partnerLabel: string,
 *   fromYmd: string,
 *   toYmd: string,
 *   rows: object[],
 *   axis?: 'created'|'checkout',
 *   periodTotals?: {
 *     totalGrossThb?: number,
 *     totalCommissionThb?: number,
 *     totalNetEarnedThb?: number,
 *     totalPaidOutThb?: number,
 *     bookingCount?: number,
 *     payoutCount?: number,
 *     linkedSettlementDocs?: { documentNo?: string }[],
 *   } | null,
 * }} opts
 * @returns {Promise<Buffer>}
 */
export function renderPartnerFinancialStatementPdf(opts) {
  const { partnerLabel, fromYmd, toYmd, rows, axis, periodTotals } = opts
  const safeRows = Array.isArray(rows) ? rows : []

  return new Promise((resolve, reject) => {
    const { doc, font: headerFont } = createPartnerPdfDocument({ margin: 48, size: 'A4', bufferPages: false })
    const chunks = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    const titleY = doc.y
    const siteName = getSiteDisplayName()
    doc.fillColor('#111111').font(headerFont).fontSize(16).text(`Financial Statement — ${siteName}`, {
      underline: true,
    })
    const logoPath = path.join(process.cwd(), 'public', 'images', 'logo-black.png')
    if (fs.existsSync(logoPath)) {
      try {
        const logoW = 72
        const marginRight = 48
        doc.image(logoPath, doc.page.width - marginRight - logoW, titleY, {
          width: logoW,
        })
      } catch {
        /* optional branding */
      }
    }
    doc.moveDown(0.15)
    doc.fontSize(10).fillColor('#333333')
    let yMeta = doc.y
    drawPdfUnicodeLine(doc, `Partner: ${String(partnerLabel || '—').slice(0, 120)}`, 48, yMeta, { fontSize: 10 })
    doc.y = yMeta + 14
    doc
      .font(headerFont)
      .text(`Filter: ${axisFilterLabel(axis)} between ${fromYmd} and ${toYmd} (UTC day bounds).`)
    doc.text(`Generated (UTC): ${new Date().toISOString()}`)
    if (periodTotals) {
      doc.text(
        `Period pack — Gross: ${round2(periodTotals.totalGrossThb).toFixed(2)} THB   Fee: ${round2(periodTotals.totalCommissionThb).toFixed(2)} THB   Net earned: ${round2(periodTotals.totalNetEarnedThb).toFixed(2)} THB   Paid out: ${round2(periodTotals.totalPaidOutThb).toFixed(2)} THB`,
      )
    }
    doc.moveDown(0.8)
    doc.fillColor('#000000').fontSize(9)

    let totalGross = 0
    let totalFee = 0
    let totalNet = 0

    doc.font(headerFont).fontSize(8).fillColor('#555555')
    doc.text('Date        Booking ID                          Status      Gross      Fee        Net', {
      continued: false,
    })
    doc.moveDown(0.2)
    doc.fillColor('#000000').fontSize(8)

    for (const b of safeRows) {
      const snap = buildBookingFinancialSnapshotFromRow(b)
      if (!snap) continue
      const g = round2(snap.gross)
      const f = round2(snap.fee)
      const n = round2(snap.net)
      totalGross += g
      totalFee += f
      totalNet += n
      const created = String(b.created_at || '').slice(0, 10) || '—'
      const id = String(b.id || '').slice(0, 36)
      const st = String(b.status || '').slice(0, 14)
      const line = `${created}  ${id}  ${st}  ${g.toFixed(2)}  ${f.toFixed(2)}  ${n.toFixed(2)}`
      const rowY = doc.y
      doc.font(headerFont).text(line, { width: 500 })
      doc.y = Math.max(doc.y, rowY + 12)
    }

    doc.moveDown(0.6)
    doc.fontSize(10).font(headerFont)
    const footerGross = periodTotals ? round2(periodTotals.totalGrossThb) : round2(totalGross)
    const footerFee = periodTotals ? round2(periodTotals.totalCommissionThb) : round2(totalFee)
    const footerNet = periodTotals ? round2(periodTotals.totalNetEarnedThb) : round2(totalNet)
    doc.text(
      `Totals — Gross: ${footerGross.toFixed(2)} THB   Fee: ${footerFee.toFixed(2)} THB   Net: ${footerNet.toFixed(2)} THB`,
    )
    if (periodTotals) {
      doc.text(
        `Paid out (PAID/COMPLETED payouts in period): ${round2(periodTotals.totalPaidOutThb).toFixed(2)} THB` +
          (periodTotals.payoutCount != null ? `  ·  ${periodTotals.payoutCount} payout(s)` : ''),
      )
      const docNos = (periodTotals.linkedSettlementDocs || [])
        .map((d) => d.documentNo)
        .filter(Boolean)
        .slice(0, 12)
      if (docNos.length) {
        doc.font(headerFont).fontSize(8).fillColor('#333333')
        doc.text(`Closing acts: ${docNos.join(', ')}`, { width: 500 })
      }
    }
    doc.font(headerFont).fontSize(8).fillColor('#666666')
    doc.moveDown(0.5)
    doc.text(
      'Amounts are derived from the same booking read-model as the partner dashboard (pricing_snapshot + settlement). For tax reporting, verify dates and rules with your advisor.',
      { width: 500 },
    )

    doc.end()
  })
}
