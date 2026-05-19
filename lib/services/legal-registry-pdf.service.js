/**
 * PDF-справка по активным юр. документам для владельца (Stage 102.3).
 * Полные тексты — на публичных URL; PDF фиксирует версии и ссылки.
 */

import { getSiteDisplayName, getPublicSiteUrl } from '@/lib/site-url.js'
import { getLegalPublisherDetails } from '@/lib/config/legal-details.js'
import { createPartnerPdfDocument, drawPdfUnicodeLine } from '@/lib/services/partner-pdf-fonts'

const LEGAL_PAGES = [
  { key: 'guest_offer', title: 'Публичная оферта (гости)', path: '/legal/public-offer/' },
  { key: 'partner_terms', title: 'Условия для партнёров', path: '/legal/partner-terms/' },
  { key: 'privacy', title: 'Политика конфиденциальности', path: '/legal/privacy/' },
  { key: 'refund', title: 'Возвраты и отмены', path: '/legal/refund/' },
  { key: 'terms', title: 'Пользовательское соглашение (кратко)', path: '/terms/' },
]

/**
 * @param {{ registry: { guest: object, partner: object } }} opts
 * @returns {Promise<Buffer>}
 */
export function renderLegalRegistryPdf(opts) {
  const registry = opts?.registry || {}
  const publisher = getLegalPublisherDetails()
  const site = getSiteDisplayName()
  const origin = getPublicSiteUrl()

  return new Promise((resolve, reject) => {
    const { doc, font } = createPartnerPdfDocument({ margin: 48, size: 'A4' })
    const chunks = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.font(font).fontSize(16).fillColor('#111').text(`Юридические документы — ${site}`)
    doc.moveDown(0.3)
    doc.font(font).fontSize(10).fillColor('#444')
    drawPdfUnicodeLine(doc, `Оператор: ${publisher.companyName}`, 48, doc.y, { fontSize: 10 })
    doc.y += 14
    drawPdfUnicodeLine(doc, `ИНН ${publisher.inn} · ОГРНИП ${publisher.ogrnip}`, 48, doc.y, { fontSize: 10 })
    doc.y += 14
    doc.font(font).text(`Сформировано (UTC): ${new Date().toISOString()}`)
    doc.moveDown(1)

    doc.font(font).fontSize(12).fillColor('#000').text('Активные версии для акцепта')
    doc.moveDown(0.4)
    doc.font(font).fontSize(10)
    doc.text(`Гостевая оферта: ${registry.guest?.currentVersion || '—'}`)
    if (registry.guest?.publishedAt) {
      doc.text(`Опубликована: ${registry.guest.publishedAt}`)
    }
    doc.moveDown(0.3)
    doc.text(`Условия партнёров: ${registry.partner?.currentVersion || '—'}`)
    if (registry.partner?.publishedAt) {
      doc.text(`Опубликованы: ${registry.partner.publishedAt}`)
    }
    doc.moveDown(1)

    doc.font(font).fontSize(12).text('Ссылки на документы')
    doc.moveDown(0.4)
    doc.font(font).fontSize(9).fillColor('#222')
    for (const page of LEGAL_PAGES) {
      const url = `${origin}${page.path}`
      doc.font(font).text(`${page.title}`)
      doc.font(font).fillColor('#0d9488').text(url, { link: url, underline: true })
      doc.font(font).fillColor('#222').moveDown(0.35)
    }

    doc.moveDown(0.8)
    doc.font(font).fillColor('#555').fontSize(8).text(
      'Полный текст каждого документа размещён на сайте по указанным ссылках. ' +
        'При смене версии оферты новые акцепты фиксируются с актуальным номером версии в базе данных.',
      { align: 'left' },
    )

    doc.end()
  })
}

export { LEGAL_PAGES }
