/**
 * Marketing ROI for marketplace-health — delegates to SSOT report (Stage 127.0).
 * Same engine as `/admin/marketing/roi` (`buildReferralRoiReport`, 30d).
 *
 * @see lib/analytics/reports/referral-roi.report.js
 */

import { REFERRAL_GUEST_MARGIN_BOOKING_STATUSES } from '@/lib/booking/status-sets.js'
import buildReferralRoiReport from '@/lib/analytics/reports/referral-roi.report.js'

export { REFERRAL_GUEST_MARGIN_BOOKING_STATUSES }

const PERIOD_PRESET = '30d'

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} [_supabaseAdmin] — kept for API compat; report uses service client
 * @returns {Promise<{
 *   referralGrossMarginThb: number,
 *   referralPaidBonusesThb: number,
 *   referralRoi: number | null,
 *   refereeCount: number,
 *   bookingRowsScanned: number,
 *   bonusLedgerRows: number,
 *   source?: string,
 *   periodPreset?: string,
 *   estimateNote?: string,
 *   error?: string,
 * }>}
 */
export async function loadMarketingReferralRoiStats(_supabaseAdmin) {
  const empty = {
    referralGrossMarginThb: 0,
    referralPaidBonusesThb: 0,
    referralRoi: null,
    refereeCount: 0,
    bookingRowsScanned: 0,
    bonusLedgerRows: 0,
  }

  try {
    const report = await buildReferralRoiReport({ periodPreset: PERIOD_PRESET, skipCache: true })
    const overall = report?.overall || {}
    const funnel = report?.funnelSummary || {}
    const bookingRowsScanned = Number(report?.meta?.bookingIdsInPeriod) || 0

    return {
      referralGrossMarginThb: Number(overall.referredCommissionThb) || 0,
      referralPaidBonusesThb: Number(overall.earnedBonusesThb) || 0,
      referralRoi: overall.roiIndex != null ? Number(overall.roiIndex) : null,
      refereeCount:
        Number(funnel.firstBookingUsersCount) ||
        Number(funnel.refereesWithBookings) ||
        Number(funnel.referees) ||
        0,
      bookingRowsScanned,
      bonusLedgerRows: (Number(overall.earnedBonusesThb) || 0) > 0 ? bookingRowsScanned : 0,
      source: 'buildReferralRoiReport',
      periodPreset: PERIOD_PRESET,
      estimateNote: 'SSOT: тот же расчёт, что /admin/marketing/roi (30d)',
    }
  } catch (err) {
    return {
      ...empty,
      error: err?.message || 'referral_roi_report_failed',
    }
  }
}
