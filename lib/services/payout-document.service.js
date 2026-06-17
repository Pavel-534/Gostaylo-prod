/**
 * Генерация, Storage и email PDF по выплатам (Stage 102.3).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { uploadBufferToStorage, createStorageSignedUrl } from '@/lib/storage/storage-upload.server.js'
import { renderPartnerPayoutActPdf } from '@/lib/services/partner-payout-act-pdf.service.js'
import { EmailService } from '@/lib/services/email.service.js'
import { getSiteDisplayName, getPublicSiteUrl } from '@/lib/site-url.js'
import { premiumEmailDocument } from '@/lib/email/premium-email-html.js'

const PAYOUT_DOCS_BUCKET = 'payout-documents'

function round2(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(x * 100) / 100
}

async function loadPartnerProfile(partnerId) {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, email, full_name, first_name, last_name, company_name')
    .eq('id', partnerId)
    .maybeSingle()
  return data
}

function partnerDisplayName(p) {
  if (!p) return 'Партнёр'
  return (
    p.full_name ||
    [p.first_name, p.last_name].filter(Boolean).join(' ') ||
    p.company_name ||
    `Партнёр ${String(p.id).slice(0, 8)}`
  )
}

async function sendSettlementEmail({ to, partnerName, documentNo, amountThb, signedUrl }) {
  if (!to) return { skipped: true, reason: 'no_email' }
  const site = getSiteDisplayName()
  const partnerUrl = `${getPublicSiteUrl()}/partner/finances`
  const bodyRows = `
    <p>Здравствуйте, ${partnerName}!</p>
    <p>По вашей выплате на платформе <strong>${site}</strong> сформирован документ <strong>№ ${documentNo}</strong>.</p>
    <p>Сумма расчёта: <strong>${round2(amountThb).toLocaleString('ru-RU')} THB</strong>.</p>
    <p><a href="${signedUrl}" style="color:#0d9488">Скачать акт (PDF)</a> — ссылка действует ограниченное время.</p>
    <p>Раздел «Финансы» в кабинете партнёра: <a href="${partnerUrl}">${partnerUrl}</a></p>
  `
  const template = {
    subject: `${site}: документ по выплате № ${documentNo}`,
    html: premiumEmailDocument({
      preheader: 'Акт о расчёте по выплате',
      bodyRowsHtml: bodyRows,
    }),
  }
  return EmailService.sendEmail(to, template)
}

/**
 * @param {object} payoutRow — строка payouts
 */
export async function generatePayoutRequestDocuments(payoutRow) {
  if (!supabaseAdmin || !payoutRow?.id || !payoutRow?.partner_id) {
    return { success: false, error: 'invalid_input' }
  }

  const partner = await loadPartnerProfile(payoutRow.partner_id)
  const amountThb = round2(
    payoutRow.gross_amount ?? payoutRow.amount ?? payoutRow.final_amount ?? 0,
  )
  if (amountThb <= 0) {
    return { success: false, error: 'non_positive_amount' }
  }

  const documentNo = `PO-${String(payoutRow.id).slice(0, 8).toUpperCase()}`
  const pdf = await renderPartnerPayoutActPdf({
    documentNo,
    partnerLabel: partnerDisplayName(partner),
    partnerInn: partner?.inn || null,
    settlementType: 'payout',
    amountThb,
    payoutCurrency: payoutRow.payout_currency || payoutRow.currency,
    amountInPayoutCurrency: payoutRow.amount_in_payout_currency,
    payoutId: payoutRow.id,
    settledAt: new Date().toISOString(),
  })

  const objectPath = `${payoutRow.partner_id}/payout-${payoutRow.id}-act.pdf`
  const uploaded = await uploadBufferToStorage({
    bucket: PAYOUT_DOCS_BUCKET,
    path: objectPath,
    buffer: pdf,
    contentType: 'application/pdf',
    upsert: true,
  })
  if (!uploaded.success) {
    return { success: false, error: uploaded.error || 'upload_failed' }
  }

  const generatedAt = new Date().toISOString()
  const documents = {
    act: {
      path: objectPath,
      bucket: PAYOUT_DOCS_BUCKET,
      generatedAt,
      documentNo,
    },
  }

  const prevDocs =
    payoutRow.documents && typeof payoutRow.documents === 'object' ? payoutRow.documents : {}
  const docPayload = { documents: { ...prevDocs, ...documents } }
  let { error: upErr } = await supabaseAdmin
    .from('payouts')
    .update({ ...docPayload, updated_at: generatedAt })
    .eq('id', payoutRow.id)

  if (upErr && String(upErr.message || '').includes('updated_at')) {
    ;({ error: upErr } = await supabaseAdmin
      .from('payouts')
      .update(docPayload)
      .eq('id', payoutRow.id))
  }

  if (upErr) {
    console.error('[PayoutDocument] update payouts', upErr.message)
  }

  let emailResult = { skipped: true }
  const signed = await createStorageSignedUrl(PAYOUT_DOCS_BUCKET, objectPath, 7 * 86400)
  if (signed.success && partner?.email) {
    emailResult = await sendSettlementEmail({
      to: partner.email,
      partnerName: partnerDisplayName(partner),
      documentNo,
      amountThb,
      signedUrl: signed.signedUrl,
    })
  }

  return {
    success: true,
    payoutId: payoutRow.id,
    documents,
    email: emailResult,
  }
}

/**
 * После закрытия пула — акт на партнёра по сумме строк пула.
 * @param {string} batchId
 * @param {Array<{ partner_id: string, booking_id: string, amount_thb: number }>} items
 */
export async function generateBatchPartnerSettlementDocuments(batchId, items = []) {
  if (!supabaseAdmin || !batchId) return { success: false, error: 'invalid_input' }

  const byPartner = new Map()
  for (const item of items) {
    const pid = item.partner_id
    if (!pid) continue
    const cur = byPartner.get(pid) || { amountThb: 0, bookingIds: [] }
    cur.amountThb += round2(item.amount_thb)
    if (item.booking_id) cur.bookingIds.push(item.booking_id)
    byPartner.set(pid, cur)
  }

  const results = []
  const partnerDocs = {}

  for (const [partnerId, agg] of byPartner) {
    const amountThb = round2(agg.amountThb)
    if (amountThb <= 0) continue

    const partner = await loadPartnerProfile(partnerId)
    const documentNo = `PB-${String(batchId).slice(0, 8).toUpperCase()}-${String(partnerId).slice(0, 6).toUpperCase()}`
    const pdf = await renderPartnerPayoutActPdf({
      documentNo,
      partnerLabel: partnerDisplayName(partner),
      partnerInn: partner?.inn || null,
      settlementType: 'batch',
      amountThb,
      bookingIds: agg.bookingIds,
      batchId,
      settledAt: new Date().toISOString(),
    })

    const objectPath = `${partnerId}/batch-${batchId}-act.pdf`
    const uploaded = await uploadBufferToStorage({
      bucket: PAYOUT_DOCS_BUCKET,
      path: objectPath,
      buffer: pdf,
      contentType: 'application/pdf',
      upsert: true,
    })

    if (!uploaded.success) {
      results.push({ partnerId, success: false, error: uploaded.error })
      continue
    }

    const generatedAt = new Date().toISOString()
    partnerDocs[partnerId] = {
      act: { path: objectPath, bucket: PAYOUT_DOCS_BUCKET, generatedAt, documentNo, amountThb },
    }

    const signed = await createStorageSignedUrl(PAYOUT_DOCS_BUCKET, objectPath, 7 * 86400)
    if (signed.success && partner?.email) {
      await sendSettlementEmail({
        to: partner.email,
        partnerName: partnerDisplayName(partner),
        documentNo,
        amountThb,
        signedUrl: signed.signedUrl,
      })
    }

    results.push({ partnerId, success: true, documentNo, amountThb })
  }

  if (Object.keys(partnerDocs).length) {
    const { data: batch } = await supabaseAdmin
      .from('payout_batches')
      .select('metadata')
      .eq('id', batchId)
      .maybeSingle()
    const meta = batch?.metadata && typeof batch.metadata === 'object' ? batch.metadata : {}
    const { error: metaErr } = await supabaseAdmin
      .from('payout_batches')
      .update({
        metadata: {
          ...meta,
          partner_settlement_documents: partnerDocs,
          settlement_documents_generated_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', batchId)
    if (metaErr) {
      console.error('[PayoutDocument] batch metadata update', batchId, metaErr.message)
      return { success: false, error: metaErr.message, batchId, results, partnerDocs }
    }
  }

  return { success: true, batchId, results, partnerDocs }
}
