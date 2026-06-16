/**
 * Stage 106.2 — ZIP export of legal documents for owner archive.
 */

import JSZip from 'jszip'
import { LegalVersionsService } from '@/lib/services/legal-versions.service.js'
import { LEGAL_PAGES, renderLegalRegistryPdf } from '@/lib/services/legal-registry-pdf.service.js'
import { getPublicSiteUrl, getSiteDisplayName, getSiteBrandSlug } from '@/lib/site-url.js'
import { getLegalPublisherDetails } from '@/lib/config/legal-details.js'

/**
 * @returns {Promise<{ success: boolean, buffer?: Buffer, error?: string }>}
 */
export async function buildLegalDocumentsExportZip() {
  try {
    const registry = await LegalVersionsService.getRegistry()
    const origin = getPublicSiteUrl()
    const publisher = getLegalPublisherDetails()
    const site = getSiteDisplayName()
    const zip = new JSZip()
    const stamp = new Date().toISOString().slice(0, 10)

    const readme =
      `${site} — архив юридических документов\n` +
      `Дата выгрузки (UTC): ${new Date().toISOString()}\n` +
      `Оператор: ${publisher.companyName}, ИНН ${publisher.inn}\n\n` +
      `Версия оферты гостя: ${registry.guest?.currentVersion || '—'}\n` +
      `Версия условий партнёра: ${registry.partner?.currentVersion || '—'}\n\n` +
      `Папка pages/ — HTML-страницы с сайта на момент выгрузки.\n` +
      `legal-versions-summary.pdf — справка со ссылками и версиями.\n` +
      `versions.json — машиночитаемый снимок реестра.\n`

    zip.file('README.txt', readme)
    zip.file('versions.json', JSON.stringify(registry, null, 2))

    const pdf = await renderLegalRegistryPdf({ registry })
    zip.file('legal-versions-summary.pdf', pdf)

    for (const page of LEGAL_PAGES) {
      const url = `${origin}${page.path}`
      try {
        const res = await fetch(url, {
          headers: { Accept: 'text/html', 'User-Agent': `${getSiteBrandSlug()}-Legal-Export/106.2` },
          cache: 'no-store',
        })
        if (!res.ok) {
          zip.file(
            `pages/${page.key}.txt`,
            `${page.title}\nURL: ${url}\nОшибка загрузки: HTTP ${res.status}\n`,
          )
          continue
        }
        const html = await res.text()
        zip.file(`pages/${page.key}.html`, html)
      } catch (e) {
        zip.file(
          `pages/${page.key}.txt`,
          `${page.title}\nURL: ${url}\nНе удалось загрузить: ${e?.message || e}\n`,
        )
      }
    }

    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
    return { success: true, buffer, filename: `legal-documents-${stamp}.zip` }
  } catch (e) {
    return { success: false, error: e?.message || String(e) }
  }
}
