/**
 * Stage 114.4 — фильтры referral_ledger для FinTech export / liability.
 */
import { supabaseAdmin } from '@/lib/supabase'

/**
 * @param {{
 *   status?: string,
 *   type?: string,
 *   referralType?: string,
 *   dateFrom?: string,
 *   dateTo?: string,
 *   referrerId?: string,
 *   bookingId?: string,
 *   limit?: number,
 * }} filters
 */
export function buildReferralLedgerQuery(filters = {}) {
  const limit = Math.min(5000, Math.max(1, Number(filters.limit) || 500))
  let q = supabaseAdmin
    .from('referral_ledger')
    .select(
      'id,amount_thb,type,status,referral_type,ledger_depth,earned_at,created_at,updated_at,referrer_id,referee_id,booking_id,metadata',
    )
    .order('created_at', { ascending: false })
    .limit(limit)

  const status = String(filters.status || '').trim().toLowerCase()
  if (status && status !== 'all') q = q.eq('status', status)

  const type = String(filters.type || '').trim().toLowerCase()
  if (type && type !== 'all') q = q.eq('type', type)

  const referralType = String(filters.referralType || '').trim().toLowerCase()
  if (referralType && referralType !== 'all') q = q.eq('referral_type', referralType)

  const referrerId = String(filters.referrerId || '').trim()
  if (referrerId) q = q.eq('referrer_id', referrerId)

  const bookingId = String(filters.bookingId || '').trim()
  if (bookingId) q = q.ilike('booking_id', `%${bookingId}%`)

  const dateFrom = String(filters.dateFrom || '').trim()
  if (dateFrom) q = q.gte('created_at', `${dateFrom}T00:00:00.000Z`)

  const dateTo = String(filters.dateTo || '').trim()
  if (dateTo) q = q.lte('created_at', `${dateTo}T23:59:59.999Z`)

  return q
}
