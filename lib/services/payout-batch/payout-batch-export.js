/**
 * Stage 109.2 — payout batch export (registry CSV/JSON, period CSV).
 */
import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { getBatchWithItems } from '@/lib/services/payout-batch/payout-batch-shared.js'

/**
 * @param {string} batchId
 * @param {'json' | 'csv'} format
 */
export async function exportBatchRegistry(batchId, format = 'json') {
  const pack = await getBatchWithItems(batchId)
  if (!pack?.batch) return { error: 'not_found' }

  const rows = (pack.items || []).map((item) => ({
    batch_id: batchId,
    booking_id: item.booking_id,
    partner_id: item.partner_id,
    amount_thb: item.amount_thb,
    amount_rub: item.amount_rub,
    amount_in_payout_currency: item.amount_in_payout_currency,
    payout_currency: item.payout_currency,
    payout_rail: pack.batch.rail || item.metadata?.payout_rail,
    status: item.status,
  }))

  const payload = {
    batch: pack.batch,
    exported_at: new Date().toISOString(),
    items: rows,
  }
  const body = format === 'csv' ? registryToCsv(rows) : JSON.stringify(payload, null, 2)
  const checksum = createHash('sha256').update(body).digest('hex')

  const batchSt = String(pack.batch.status || '')
    .trim()
    .toUpperCase()
  if (batchSt === 'LOCKED') {
    const now = new Date().toISOString()
    const { error: exportUpErr } = await supabaseAdmin
      .from('payout_batches')
      .update({
        status: 'EXPORTED',
        exported_at: now,
        export_checksum: checksum,
        updated_at: now,
        metadata: {
          ...(pack.batch.metadata || {}),
          last_export_format: format,
        },
      })
      .eq('id', batchId)
    if (exportUpErr) {
      return { error: exportUpErr.message }
    }
    await supabaseAdmin
      .from('payout_batch_items')
      .update({ status: 'EXPORTED', updated_at: now })
      .eq('batch_id', batchId)
      .in('status', ['LOCKED', 'PENDING'])
  }

  return { body, checksum, contentType: format === 'csv' ? 'text/csv' : 'application/json', payload }
}

export function registryToCsv(rows) {
  const header = [
    'batch_id',
    'booking_id',
    'partner_id',
    'amount_thb',
    'amount_rub',
    'amount_in_payout_currency',
    'payout_currency',
    'payout_rail',
    'status',
  ]
  const lines = [header.join(',')]
  for (const r of rows) {
    lines.push(
      [
        r.batch_id,
        r.booking_id,
        r.partner_id,
        r.amount_thb,
        r.amount_rub ?? '',
        r.amount_in_payout_currency ?? '',
        r.payout_currency ?? '',
        r.payout_rail ?? '',
        r.status,
      ]
        .map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`)
        .join(','),
    )
  }
  return lines.join('\n')
}

/**
 * Period export for accountant (all batches in range, `;` for Excel RU).
 */
export async function exportBatchesPeriodCsv(fromDay, toDay) {
  const from = `${fromDay}T00:00:00.000Z`
  const to = `${toDay}T23:59:59.999Z`
  const { data: batches, error } = await supabaseAdmin
    .from('payout_batches')
    .select('id,status,rail,scheduled_for,totals_thb,item_count,created_at,settled_at,exported_at')
    .gte('created_at', from)
    .lte('created_at', to)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  const header = [
    'batch_id',
    'status',
    'rail',
    'scheduled_for',
    'item_count',
    'totals_thb',
    'created_at',
    'exported_at',
    'settled_at',
  ]
  const esc = (v) => {
    const raw = v == null ? '' : String(v)
    if (/[";\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`
    return raw
  }
  const rows = (batches || []).map((b) =>
    [
      b.id,
      b.status,
      b.rail,
      b.scheduled_for,
      b.item_count,
      b.totals_thb,
      b.created_at,
      b.exported_at ?? '',
      b.settled_at ?? '',
    ]
      .map(esc)
      .join(';'),
  )
  return ['\uFEFF' + header.join(';'), ...rows].join('\n')
}
