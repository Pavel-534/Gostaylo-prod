/**
 * Stage 60.0 — admin dashboard counts for `notification_outbox`.
 */
import { supabaseAdmin } from '@/lib/supabase'

const STATUSES = ['pending', 'processing', 'failed', 'permanent_failure', 'sent']

/**
 * @returns {Promise<{ success: true, counts: Record<string, number>, total: number } | { success: false, error: string, counts: Record<string, number> }>}
 */
export async function getNotificationOutboxStats() {
  const empty = Object.fromEntries(STATUSES.map((s) => [s, 0]))
  if (!supabaseAdmin?.from) {
    return { success: false, error: 'supabase_admin_missing', counts: empty }
  }

  /** @type {Record<string, number>} */
  const counts = { ...empty }
  const results = await Promise.all(
    STATUSES.map(async (status) => {
      const { count, error } = await supabaseAdmin
        .from('notification_outbox')
        .select('id', { count: 'exact', head: true })
        .eq('status', status)
      return { status, count: typeof count === 'number' && !error ? count : null, error: error?.message }
    }),
  )

  for (const r of results) {
    if (r.count != null) counts[r.status] = r.count
  }

  const firstErr = results.find((r) => r.error)?.error
  if (firstErr) {
    return { success: false, error: firstErr, counts }
  }

  const total = STATUSES.reduce((acc, s) => acc + (counts[s] || 0), 0)
  return { success: true, counts, total }
}
