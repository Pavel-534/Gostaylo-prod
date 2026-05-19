/**
 * Список PDF-актов партнёра (payouts.documents + payout_batches.metadata).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { createStorageSignedUrl } from '@/lib/storage/storage-upload.server.js'

const PAYOUT_DOCS_BUCKET = 'payout-documents'
const SIGNED_URL_SEC = 30 * 86400

function round2(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(x * 100) / 100
}

/**
 * @param {string} partnerId
 */
export async function listPartnerSettlementDocuments(partnerId) {
  if (!supabaseAdmin || !partnerId) {
    return { success: false, error: 'invalid_input', rows: [] }
  }

  const rows = []

  const { data: payouts, error: pErr } = await supabaseAdmin
    .from('payouts')
    .select('id, status, gross_amount, amount, created_at, processed_at, documents, payout_currency')
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false })
    .limit(80)

  if (pErr && !String(pErr.message || '').includes('documents')) {
    return { success: false, error: pErr.message, rows: [] }
  }

  for (const p of payouts || []) {
    const docs = p.documents && typeof p.documents === 'object' ? p.documents : {}
    const act = docs.act
    if (!act?.path) continue
    rows.push({
      id: `payout-${p.id}`,
      source: 'payout',
      refId: p.id,
      kind: 'act',
      documentNo: act.documentNo || `PO-${String(p.id).slice(0, 8).toUpperCase()}`,
      amountThb: round2(p.gross_amount ?? p.amount ?? 0),
      status: p.status,
      generatedAt: act.generatedAt || p.processed_at || p.created_at,
      payoutCurrency: p.payout_currency || null,
    })
  }

  const { data: batchItems } = await supabaseAdmin
    .from('payout_batch_items')
    .select('batch_id, amount_thb')
    .eq('partner_id', partnerId)
    .limit(200)

  const batchIds = [...new Set((batchItems || []).map((i) => i.batch_id).filter(Boolean))]
  if (batchIds.length) {
    const amountByBatch = {}
    for (const item of batchItems || []) {
      amountByBatch[item.batch_id] = round2((amountByBatch[item.batch_id] || 0) + item.amount_thb)
    }

    const { data: batches } = await supabaseAdmin
      .from('payout_batches')
      .select('id, status, settled_at, metadata, scheduled_for')
      .in('id', batchIds)
      .order('settled_at', { ascending: false })

    for (const b of batches || []) {
      const meta = b.metadata && typeof b.metadata === 'object' ? b.metadata : {}
      const partnerDocs = meta.partner_settlement_documents?.[partnerId]
      const act = partnerDocs?.act
      if (!act?.path) continue
      rows.push({
        id: `batch-${b.id}`,
        source: 'batch',
        refId: b.id,
        kind: 'act',
        documentNo: act.documentNo || `PB-${String(b.id).slice(0, 8).toUpperCase()}`,
        amountThb: round2(act.amountThb ?? amountByBatch[b.id] ?? 0),
        status: b.status,
        generatedAt: act.generatedAt || b.settled_at || b.scheduled_for,
        payoutCurrency: null,
      })
    }
  }

  rows.sort((a, b) => new Date(b.generatedAt || 0).getTime() - new Date(a.generatedAt || 0).getTime())

  return { success: true, rows }
}

/**
 * @param {string} partnerId
 * @param {'payout'|'batch'} source
 * @param {string} refId
 */
export async function getPartnerSettlementDocumentDownload(partnerId, source, refId) {
  const list = await listPartnerSettlementDocuments(partnerId)
  if (!list.success) return list

  const row = (list.rows || []).find((r) => r.source === source && r.refId === refId)
  if (!row) return { success: false, error: 'not_found' }

  let objectPath = null
  if (source === 'payout') {
    const { data: p } = await supabaseAdmin
      .from('payouts')
      .select('documents, partner_id')
      .eq('id', refId)
      .maybeSingle()
    if (p?.partner_id !== partnerId) return { success: false, error: 'forbidden' }
    objectPath = p?.documents?.act?.path
  } else {
    const { data: b } = await supabaseAdmin
      .from('payout_batches')
      .select('metadata')
      .eq('id', refId)
      .maybeSingle()
    objectPath = b?.metadata?.partner_settlement_documents?.[partnerId]?.act?.path
  }

  if (!objectPath) return { success: false, error: 'no_file' }

  const signed = await createStorageSignedUrl(PAYOUT_DOCS_BUCKET, objectPath, SIGNED_URL_SEC)
  if (!signed.success) return { success: false, error: signed.error || 'sign_failed' }

  return {
    success: true,
    signedUrl: signed.signedUrl,
    expiresInSec: SIGNED_URL_SEC,
    document: row,
  }
}

export { PAYOUT_DOCS_BUCKET }
