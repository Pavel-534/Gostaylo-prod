/**
 * AUDIT_03 M3.6 — retain critical_signal_events for 90 days.
 */

import { supabaseAdmin } from '@/lib/supabase'

const DEFAULT_RETENTION_DAYS = 90

/**
 * @param {{ retentionDays?: number }} [opts]
 * @returns {Promise<{ success: boolean, deleted: number, retentionDays: number, error?: string }>}
 */
export async function cleanupCriticalSignalEvents({ retentionDays = DEFAULT_RETENTION_DAYS } = {}) {
  if (!supabaseAdmin) {
    return { success: false, deleted: 0, retentionDays, error: 'Database not configured' }
  }

  const days = Math.max(7, Math.min(Number(retentionDays) || DEFAULT_RETENTION_DAYS, 730))
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabaseAdmin
    .from('critical_signal_events')
    .delete()
    .lt('created_at', cutoff)
    .select('id')

  if (error) {
    const msg = String(error.message || '')
    if (msg.includes("Could not find the table 'public.critical_signal_events'")) {
      return { success: true, deleted: 0, retentionDays: days, skipped: true }
    }
    return { success: false, deleted: 0, retentionDays: days, error: msg }
  }

  return { success: true, deleted: Array.isArray(data) ? data.length : 0, retentionDays: days }
}
