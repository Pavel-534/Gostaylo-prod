/**
 * Partner financial statement PDF (Stage 46.0) — rows built via read-model SSOT.
 */

import PDFDocument from 'pdfkit'
import { buildBookingFinancialSnapshotFromRow } from '@/lib/services/booking-financial-read-model.service'
import { registerPartnerPdfFonts, drawPdfUnicodeLine } from '@/lib/services/partner-pdf-fonts'

function round2(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(x * 100) / 100
}

/**
 * @param {{ partnerLabel: string, fromYmd: string, toYmd: string, rows: object[] }} opts
 * @returns {Promise<Buffer>}
 */
export function renderPartnerFinancialStatementPdf(opts) {
  const { partnerLabel, fromYmd, toYmd, rows } = opts
  const safeRows = Array.isArray(rows) ? rows : []

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4', bufferPages: false })
    const chunks = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const fontReg = registerPartnerPdfFonts(doc)
    const headerFont = fontReg.lgc ? 'PdfNotoLGC' : 'Helvetica'
    doc.fillColor('#111111').font(headerFont).fontSize(16).text('GoStayLo — Partner financial statement (THB)', {
      underline: true,
    })
    doc.moveDown(0.4)
    doc.fontSize(10).fillColor('#333333')
    let yMeta = doc.y
    drawPdfUnicodeLine(doc, `Partner: ${String(partnerLabel || '—').slice(0, 120)}`, 48, yMeta, { fontSize: 10 })
    doc.y = yMeta + 14
    doc.font(headerFont).text(`Filter: booking created_at between ${fromYmd} and ${toYmd} (UTC day bounds).`)
    doc.text(`Generated (UTC): ${new Date().toISOString()}`)
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
      if (fontReg.lgc) {
        doc.font('PdfNotoLGC')
      } else {
        doc.font('Helvetica')
      }
      doc.text(line, { width: 500 })
      doc.y = Math.max(doc.y, rowY + 12)
    }

    doc.moveDown(0.6)
    doc.fontSize(10).font('Helvetica-Bold')
    doc.text(
      `Totals — Gross: ${round2(totalGross).toFixed(2)} THB   Fee: ${round2(totalFee).toFixed(2)} THB   Net: ${round2(totalNet).toFixed(2)} THB`,
    )
    doc.font('Helvetica').fontSize(8).fillColor('#666666')
    doc.moveDown(0.5)
    doc.text(
      'Amounts are derived from the same booking read-model as the partner dashboard (pricing_snapshot + settlement). For tax reporting, verify dates and rules with your advisor.',
      { width: 500 },
    )

    doc.end()
  })
}
