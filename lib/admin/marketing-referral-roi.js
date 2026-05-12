/**
 * SSOT для ROI маркетинга (Stage 91.6): маржа платформы с броней приглашённых гостей
 * vs выплаченные реферальные бонусы (promo / referral pool).
 *
 * Маржа: сумма `bookings.commission_thb` (гостевой сервисный сбор), где `renter_id` есть в
 * `referral_relations.referee_id` и статус брони уже приносит выручку платформе.
 * Выплаты: `referral_ledger` строки `type = bonus`, `status = earned` (сумма `amount_thb`).
 */

/** Статусы брони гостя, при которых комиссия считается «в контуре» выручки платформы. */
export const REFERRAL_GUEST_MARGIN_BOOKING_STATUSES = ['PAID', 'PAID_ESCROW', 'CHECKED_IN', 'COMPLETED']

const REFEREE_CHUNK = 400
const LEDGER_PAGE = 800

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @returns {Promise<{
 *   referralGrossMarginThb: number,
 *   referralPaidBonusesThb: number,
 *   referralRoi: number | null,
 *   refereeCount: number,
 *   bookingRowsScanned: number,
 *   bonusLedgerRows: number,
 *   error?: string,
 * }>}
 */
export async function loadMarketingReferralRoiStats(supabaseAdmin) {
  const empty = {
    referralGrossMarginThb: 0,
    referralPaidBonusesThb: 0,
    referralRoi: null,
    refereeCount: 0,
    bookingRowsScanned: 0,
    bonusLedgerRows: 0,
  }
  if (!supabaseAdmin) {
    return { ...empty, error: 'supabase_admin_unavailable' }
  }

  const { data: relations, error: relErr } = await supabaseAdmin.from('referral_relations').select('referee_id')
  if (relErr) {
    return { ...empty, error: relErr.message || 'referral_relations_failed' }
  }

  const refereeIds = []
  const seen = new Set()
  for (const r of relations || []) {
    const id = String(r.referee_id || '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    refereeIds.push(id)
  }

  let referralGrossMarginThb = 0
  let bookingRowsScanned = 0

  for (let i = 0; i < refereeIds.length; i += REFEREE_CHUNK) {
    const chunk = refereeIds.slice(i, i + REFEREE_CHUNK)
    if (!chunk.length) break
    const { data: rows, error: bErr } = await supabaseAdmin
      .from('bookings')
      .select('commission_thb')
      .in('renter_id', chunk)
      .in('status', REFERRAL_GUEST_MARGIN_BOOKING_STATUSES)
    if (bErr) {
      return { ...empty, error: bErr.message || 'bookings_margin_failed', refereeCount: refereeIds.length }
    }
    for (const row of rows || []) {
      bookingRowsScanned += 1
      referralGrossMarginThb += Number(row.commission_thb) || 0
    }
  }

  let referralPaidBonusesThb = 0
  let bonusLedgerRows = 0
  let from = 0
  while (true) {
    const to = from + LEDGER_PAGE - 1
    const { data: led, error: ledErr } = await supabaseAdmin
      .from('referral_ledger')
      .select('amount_thb')
      .eq('type', 'bonus')
      .eq('status', 'earned')
      .order('created_at', { ascending: true })
      .range(from, to)
    if (ledErr) {
      return {
        ...empty,
        referralGrossMarginThb,
        bookingRowsScanned,
        refereeCount: refereeIds.length,
        error: ledErr.message || 'referral_ledger_sum_failed',
      }
    }
    const batch = led || []
    if (batch.length === 0) break
    bonusLedgerRows += batch.length
    for (const row of batch) {
      referralPaidBonusesThb += Number(row.amount_thb) || 0
    }
    if (batch.length < LEDGER_PAGE) break
    from += LEDGER_PAGE
  }

  const costs = referralPaidBonusesThb
  let referralRoi = null
  if (costs > 0) {
    referralRoi = referralGrossMarginThb / costs
  } else if (referralGrossMarginThb > 0) {
    referralRoi = null
  } else {
    referralRoi = 0
  }

  return {
    referralGrossMarginThb: Math.round(referralGrossMarginThb * 100) / 100,
    referralPaidBonusesThb: Math.round(referralPaidBonusesThb * 100) / 100,
    referralRoi,
    refereeCount: refereeIds.length,
    bookingRowsScanned,
    bonusLedgerRows,
  }
}
