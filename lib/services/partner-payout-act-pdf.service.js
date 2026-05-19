/**
 * Нейтральный акт / инвойс выплаты партнёру (Stage 102.3).
 * Без внутренних процентов комиссий платформы.
 */

import { getSiteDisplayName } from '@/lib/site-url.js'
import { getLegalPublisherDetails } from '@/lib/config/legal-details.js'
import { createPartnerPdfDocument, drawPdfUnicodeLine } from '@/lib/services/partner-pdf-fonts'

function round2(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(x * 100) / 100
}

/**
 * @param {{
 *   documentNo: string,
 *   partnerLabel: string,
 *   partnerInn?: string|null,
 *   settlementType: 'payout' | 'batch',
 *   amountThb: number,
 *   payoutCurrency?: string|null,
 *   amountInPayoutCurrency?: number|null,
 *   bookingIds?: string[],
 *   batchId?: string|null,
 *   payoutId?: string|null,
 *   settledAt?: string,
 * }} opts
 * @returns {Promise<Buffer>}
 */
export function renderPartnerPayoutActPdf(opts) {
  const publisher = getLegalPublisherDetails()
  const site = getSiteDisplayName()
  const amountThb = round2(opts.amountThb)
  const payoutCur = opts.payoutCurrency ? String(opts.payoutCurrency).toUpperCase() : null
  const amountFx =
    opts.amountInPayoutCurrency != null && Number.isFinite(Number(opts.amountInPayoutCurrency))
      ? round2(opts.amountInPayoutCurrency)
      : null
  const bookingIds = Array.isArray(opts.bookingIds) ? opts.bookingIds.slice(0, 40) : []
  const settledAt = opts.settledAt || new Date().toISOString()
  const docTitle =
    opts.settlementType === 'batch'
      ? 'Акт оказанных услуг / отчёт о расчёте'
      : 'Акт оказанных услуг / инвойс на выплату'

  return new Promise((resolve, reject) => {
    const { doc, font } = createPartnerPdfDocument({ margin: 48, size: 'A4' })
    const chunks = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.font(font).fontSize(14).fillColor('#111').text(docTitle)
    doc.font(font).fontSize(10).fillColor('#444')
    doc.text(`${site} · документ № ${String(opts.documentNo || '—').slice(0, 64)}`)
    doc.text(`Дата: ${settledAt.slice(0, 10)}`)
    doc.moveDown(0.8)

    doc.font(font).fontSize(11).fillColor('#000').text('Исполнитель (агент платформы)')
    doc.font(font).fontSize(10).fillColor('#333')
    drawPdfUnicodeLine(doc, publisher.companyName, 48, doc.y, { fontSize: 10 })
    doc.y += 14
    doc.font(font).text(`ИНН ${publisher.inn}`)
    doc.moveDown(0.6)

    doc.font(font).fontSize(11).fillColor('#000').text('Получатель (партнёр)')
    drawPdfUnicodeLine(doc, String(opts.partnerLabel || '—').slice(0, 200), 48, doc.y, { fontSize: 10 })
    doc.y += 14
    if (opts.partnerInn) {
      doc.font(font).fontSize(10).text(`ИНН / идентификатор: ${String(opts.partnerInn).slice(0, 32)}`)
    }
    doc.moveDown(0.8)

    doc.font(font).fontSize(11).text('Предмет')
    doc.font(font).fontSize(10).fillColor('#333')
    doc.text(
      'Вознаграждение партнёра по бронированиям, размещённым на платформе, ' +
        'в соответствии с принятыми условиями для партнёров и договорённостями по бронированиям.',
    )
    doc.moveDown(0.6)

    doc.font(font).fontSize(11).fillColor('#000').text('Сумма к выплате')
    doc.font(font).fontSize(12).text(`${amountThb.toLocaleString('ru-RU')} THB`, { continued: false })
    if (payoutCur && amountFx != null && payoutCur !== 'THB') {
      doc
        .font(font)
        .fontSize(10)
        .fillColor('#555')
        .text(`Эквивалент к перечислению: ${amountFx.toLocaleString('ru-RU')} ${payoutCur}`)
    }
    doc.moveDown(0.5)

    if (opts.batchId) {
      doc.font(font).fontSize(9).fillColor('#666').text(`Пул выплат: ${opts.batchId}`)
    }
    if (opts.payoutId) {
      doc.font(font).fontSize(9).text(`Заявка на вывод: ${opts.payoutId}`)
    }

    if (bookingIds.length) {
      doc.moveDown(0.5)
      doc.font(font).fontSize(10).fillColor('#000').text('Связанные бронирования (ID):')
      doc.font(font).fontSize(8).fillColor('#444')
      doc.text(bookingIds.join(', '))
      if ((opts.bookingIds || []).length > bookingIds.length) {
        doc.text(`… и ещё ${opts.bookingIds.length - bookingIds.length}`)
      }
    }

    doc.moveDown(1.2)
    doc.font(font).fontSize(8).fillColor('#666').text(
      'Документ сформирован автоматически. Не содержит коммерческой тайны платформы. ' +
        'Для вопросов по расчёту обратитесь в поддержку партнёров.',
    )

    doc.end()
  })
}
