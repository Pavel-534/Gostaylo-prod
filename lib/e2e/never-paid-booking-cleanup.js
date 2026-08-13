/**
 * Stage 201.09 — never-paid bookings that cleanup may hard-delete (no live capture).
 */

const NEVER_PAID_STATUSES = new Set([
  'CANCELLED',
  'INQUIRY',
  'PENDING',
  'CONFIRMED',
  'AWAITING_PAYMENT',
])

const STALE_UNPAID_STATUSES = ['INQUIRY', 'PENDING', 'CONFIRMED', 'AWAITING_PAYMENT']

function checkoutYmd(value) {
  const s = String(value || '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''
}

/**
 * @param {{ status?: string, check_out?: string }} row
 * @param {string} todayYmd
 */
export function isNeverPaidCleanupBooking(row, todayYmd) {
  const st = String(row?.status || '').toUpperCase()
  if (st === 'CANCELLED') return true
  if (!NEVER_PAID_STATUSES.has(st)) return false
  const cout = checkoutYmd(row?.check_out)
  return Boolean(cout && cout < todayYmd)
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {{ todayYmd?: string }} [opts]
 */
export async function fetchNeverPaidCleanupBookingIds(sb, opts = {}) {
  const todayYmd = opts.todayYmd || new Date().toISOString().slice(0, 10)
  const { data, error } = await sb
    .from('bookings')
    .select('id, status, check_out')
    .in('status', [...NEVER_PAID_STATUSES])
    .limit(2000)
  if (error) {
    console.warn('[never-paid-cleanup] bookings:', error.message)
    return []
  }
  return (data || [])
    .filter((row) => isNeverPaidCleanupBooking(row, todayYmd))
    .map((row) => String(row.id))
    .filter(Boolean)
}

export { STALE_UNPAID_STATUSES }
