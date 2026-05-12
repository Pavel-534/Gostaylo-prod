/**
 * Stage 91.3 — индикативный калькулятор «потенциала» для UI `/profile/referral`.
 * Не SSOT выплат: упрощённая модель от среднего чека и настроек `general` (reinvest + split).
 * Реальные суммы зависят от unit-economics брони и safety-lock в ReferralPnlService.
 */

const SAFETY_LOCK_ILLUSTRATION = 0.95;

function round2(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/** Доля брони, условно попадающая в «коридор» для маркетингового пула (иллюстрация, не маржа из БД). */
const ILLUSTRATIVE_BOOKING_SLICE_FOR_POOL = 0.14;

/**
 * @param {{
 *   friendCount: number,
 *   avgBookingThb: number,
 *   referralReinvestmentPercent: number,
 *   referralSplitRatio: number,
 * }} p
 * @returns {{ poolPerBookingThb: number, referrerSharePerBookingThb: number, totalReferrerThb: number }}
 */
export function estimateReferrerIllustrationThb(p) {
  const friends = Math.max(0, Math.floor(Number(p.friendCount) || 0));
  const avg = Math.max(0, Number(p.avgBookingThb) || 0);
  const reinvest = Math.min(95, Math.max(0, Number(p.referralReinvestmentPercent) || 0));
  const split = Math.min(1, Math.max(0, Number(p.referralSplitRatio) || 0));
  const slice = avg * ILLUSTRATIVE_BOOKING_SLICE_FOR_POOL;
  const poolPerBooking = round2(slice * (reinvest / 100) * SAFETY_LOCK_ILLUSTRATION);
  const referrerSharePerBooking = round2(poolPerBooking * split);
  const totalReferrer = round2(referrerSharePerBooking * friends);
  return {
    poolPerBookingThb: poolPerBooking,
    referrerSharePerBookingThb: referrerSharePerBooking,
    totalReferrerThb: totalReferrer,
  };
}
