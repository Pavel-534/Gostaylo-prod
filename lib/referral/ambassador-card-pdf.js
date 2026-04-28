/**
 * Генерация PDF-визитки амбассадора в браузере (минималистичный layout + марка Airrento).
 * Вызывать только на клиенте (после dynamic import).
 *
 * Имена на RU/EN/ZH/TH: jsPDF Helvetica не содержит глифов для части языков —
 * без встраиваемого Noto/Sarabun возможны «дыры» в тексте; для точного отображения CJK/TH нужен custom font.
 */

import { formatReferralDateDdMmYyyy } from '@/lib/referral/format-referral-datetime'

/**
 * @param {{
 *   brandName: string,
 *   displayName: string,
 *   ambassadorBadgeLabel: string,
 *   referralLink: string,
 *   landingShareUrl?: string,
 *   landingShortLabel?: string,
 *   ctaLine?: string,
 *   fileBaseName?: string,
 *   officialStatusLine?: string,
 *   airrentoSubtitle?: string,
 * }} opts
 */
export async function downloadAmbassadorCardPdf(opts) {
  if (typeof window === 'undefined') return

  const brandName = String(opts.brandName || 'Platform').trim() || 'Platform'
  const displayName = String(opts.displayName || 'Ambassador').trim() || 'Ambassador'
  const ambassadorBadgeLabel = String(opts.ambassadorBadgeLabel || 'Ambassador').trim()
  const referralLink = String(opts.referralLink || '').trim()
  const landingShareUrl = String(opts.landingShareUrl || '').trim()
  const linkForQr = landingShareUrl || referralLink
  const linkForPrint = String(opts.landingShortLabel || '').trim() || linkForQr
  const officialStatusLine =
    String(opts.officialStatusLine || 'Official Ambassador').trim() || 'Official Ambassador'
  const airrentoSubtitle = String(opts.airrentoSubtitle || 'Airrento').trim() || 'Airrento'
  const ctaLine =
    String(opts.ctaLine || '').trim() ||
    'Invite friends — earn rewards on every trip.'

  const { jsPDF } = await import('jspdf')
  const QRCode = (await import('qrcode')).default

  const W = 90
  const H = 54
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [W, H] })

  doc.setFillColor(252, 252, 253)
  doc.rect(0, 0, W, H, 'F')

  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.25)
  doc.rect(3, 3, W - 6, H - 6, 'S')

  const logoSz = 9
  const lx = 8
  const ly = 7
  doc.setFillColor(13, 148, 136)
  doc.roundedRect(lx, ly, logoSz, logoSz, 1.4, 1.4, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(logoSz * 0.52)
  doc.text('A', lx + logoSz / 2, ly + logoSz * 0.72, { align: 'center' })

  const textLeft = lx + logoSz + 3
  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(brandName.toUpperCase(), textLeft, 13)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.2)
  doc.setTextColor(100, 116, 139)
  doc.text(airrentoSubtitle, textLeft, 17)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.setTextColor(59, 130, 246)
  doc.text(officialStatusLine, textLeft, 20.5)

  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  const nameLines = doc.splitTextToSize(displayName, 52)
  doc.text(nameLines, 8, 29)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(71, 85, 105)
  doc.text(ambassadorBadgeLabel, 8, 29 + nameLines.length * 5 + 2)

  doc.setFontSize(6.5)
  doc.setTextColor(100, 116, 139)
  const ctaLines = doc.splitTextToSize(ctaLine, 52)
  doc.text(ctaLines, 8, H - 14)

  if (linkForQr) {
    const qrDataUrl = await QRCode.toDataURL(linkForQr, {
      width: 240,
      margin: 1,
      errorCorrectionLevel: 'M',
    })
    const qrSize = 26
    doc.addImage(qrDataUrl, 'PNG', W - qrSize - 8, 18, qrSize, qrSize)

    doc.setFontSize(5.5)
    doc.setTextColor(148, 163, 184)
    const linkLines = doc.splitTextToSize(linkForPrint, 52)
    doc.text(linkLines, 8, H - 6)
  }

  doc.setFontSize(5)
  doc.setTextColor(148, 163, 184)
  doc.text(formatReferralDateDdMmYyyy(new Date()), W - 38, H - 3)

  const safe = String(opts.fileBaseName || 'ambassador-card')
    .replace(/[^\w\-]+/g, '-')
    .slice(0, 48)
  doc.save(`${safe}.pdf`)
}
