/**
 * ZIP «пакет для банка» по пулу выплат (Stage 102.4).
 */

import JSZip from 'jszip'
import { supabaseAdmin } from '@/lib/supabase'
import PayoutBatchService from '@/lib/services/payout-batch.service.js'
import { getPayoutRailMeta, normalizePayoutRail } from '@/lib/treasury/payout-rails.js'
import { LegalVersionsService } from '@/lib/services/legal-versions.service.js'
import { renderLegalRegistryPdf } from '@/lib/services/legal-registry-pdf.service.js'
import { PAYOUT_DOCS_BUCKET } from '@/lib/services/partner-settlement-documents.service.js'

async function downloadStorageObject(path) {
  if (!supabaseAdmin || !path) return null
  const { data, error } = await supabaseAdmin.storage.from(PAYOUT_DOCS_BUCKET).download(path)
  if (error) {
    console.warn('[BankPackage] download', path, error.message)
    return null
  }
  return Buffer.from(await data.arrayBuffer())
}

/**
 * @param {string} batchId
 * @returns {Promise<{ success: boolean, buffer?: Buffer, error?: string, actsCount?: number }>}
 */
export async function buildPayoutBatchBankPackageZip(batchId) {
  if (!batchId) return { success: false, error: 'missing_batch_id' }

  const pack = await PayoutBatchService.getBatchWithItems(batchId)
  if (!pack?.batch) return { success: false, error: 'not_found' }

  const csvExport = await PayoutBatchService.exportBatchRegistry(batchId, 'csv')
  const registry = await LegalVersionsService.getRegistry()
  const legalPdf = await renderLegalRegistryPdf({ registry })

  const rail = normalizePayoutRail(pack.batch.rail)
  const railMeta = getPayoutRailMeta(rail)
  const registryFileName = `${railMeta.registryFileBase}.csv`

  const partnerDocs = pack.batch.metadata?.partner_settlement_documents || {}
  const zip = new JSZip()

  const readme = [
    `Пакет выплат GoStayLo`,
    `Пул: ${batchId}`,
    `Рельс: ${railMeta.ownerLabel} (${rail})`,
    `Статус: ${pack.batch.status}`,
    `Сформирован: ${new Date().toISOString()}`,
    ``,
    `Содержимое:`,
    `- ${registryFileName} — реестр броней пула (рельс ${railMeta.ownerShort})`,
    `- legal-versions.pdf — справка по версиям оферты`,
    `- acts/ — PDF-акты по партнёрам (если пул закрыт)`,
    ``,
    `Гостевая оферта: ${registry.guest?.currentVersion || '—'}`,
    `Условия партнёров: ${registry.partner?.currentVersion || '—'}`,
    ``,
    `Примечание: пулы RUB Direct и KG/USDT формируются отдельно — не смешивайте реестры в одном банковском платеже.`,
  ].join('\n')

  zip.file('README.txt', readme)
  if (csvExport.body) zip.file(registryFileName, csvExport.body)
  zip.file('legal-versions.pdf', legalPdf)

  let actsCount = 0
  for (const [, docMeta] of Object.entries(partnerDocs)) {
    const act = docMeta?.act
    if (!act?.path) continue
    const pdf = await downloadStorageObject(act.path)
    if (!pdf) continue
    const safeName = String(act.documentNo || 'act').replace(/[^\w.-]+/g, '_')
    zip.file(`acts/${safeName}.pdf`, pdf)
    actsCount += 1
  }

  if (actsCount === 0 && (pack.items || []).length) {
    zip.file(
      'acts/PENDING.txt',
      'Акты партнёров создаются при закрытии пула («Отметить как оплаченный»).',
    )
  }

  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })

  return { success: true, buffer, batch: pack.batch, actsCount }
}
