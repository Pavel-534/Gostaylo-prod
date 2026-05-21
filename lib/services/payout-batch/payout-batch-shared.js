/**
 * Stage 109.2 — payout batch shared helpers.
 */
import { supabaseAdmin } from '@/lib/supabase'

export const BATCH_STATUSES = ['DRAFT', 'LOCKED', 'EXPORTED', 'SETTLED', 'FAILED', 'CANCELLED']
export const OPEN_PARTNER_PAYOUT_STATUSES = ['PENDING', 'PROCESSING']

export function round2(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(x * 100) / 100
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

/** Mon=1, Thu=4 (local server TZ) */
export function isScheduledPayoutPoolDay(date = new Date()) {
  const dow = date.getDay()
  return dow === 1 || dow === 4
}

export function newBatchId(prefix = 'pb') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export async function getBatchWithItems(batchId) {
  const { data: batch, error } = await supabaseAdmin
    .from('payout_batches')
    .select('*')
    .eq('id', batchId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!batch) return null
  const { data: items } = await supabaseAdmin
    .from('payout_batch_items')
    .select('*')
    .eq('batch_id', batchId)
  return { batch, items: items || [] }
}
