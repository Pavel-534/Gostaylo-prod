/**
 * Stage 201.47 — delete expired inquiry/invoice calendar_blocks (orphan holds after tests/cron).
 * Availability already ignores expired rows; partner wizard was still listing them as «iCal».
 */

import { INQUIRY_HOLD_SOURCE, INVOICE_HOLD_SOURCE } from '@/lib/calendar/block-source-display.js'

const HOLD_SOURCES = [INVOICE_HOLD_SOURCE, INQUIRY_HOLD_SOURCE]

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {{ nowIso?: string }} [opts]
 * @returns {Promise<{ success: boolean, deleted: number, error?: string }>}
 */
export async function purgeExpiredCalendarHoldBlocks(sb, opts = {}) {
  if (!sb) return { success: false, deleted: 0, error: 'no_client' }
  const nowIso = String(opts.nowIso || new Date().toISOString())

  const { data, error } = await sb
    .from('calendar_blocks')
    .delete()
    .in('source', HOLD_SOURCES)
    .lte('expires_at', nowIso)
    .select('id')

  if (error) {
    console.warn('[purge-expired-hold-blocks]', error.message)
    return { success: false, deleted: 0, error: error.message }
  }

  return { success: true, deleted: (data || []).length }
}
