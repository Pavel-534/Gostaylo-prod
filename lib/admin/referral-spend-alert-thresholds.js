/**
 * Dual independent referral spend thresholds (ADR-131A §9.7).
 * Does not change program-cap defer mechanics.
 */

function round2(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

export const REFERRAL_PROGRAM_CAP_WARN_PERCENT = 80

/**
 * @param {{ monthlySpendAlertThb: number, programCapThb: number, monthlySpendWarnPercent?: number }} input
 */
export function deriveReferralSpendAlertThresholds(input) {
  const monthlySpendAlertThb = round2(Math.max(0, Number(input?.monthlySpendAlertThb) || 0))
  const programCapThb = round2(Math.max(0, Number(input?.programCapThb) || 0))
  const warnPctRaw = Number(input?.monthlySpendWarnPercent)
  const monthlySpendWarnPercent =
    Number.isFinite(warnPctRaw) && warnPctRaw > 0 && warnPctRaw < 100
      ? Math.round(warnPctRaw * 10) / 10
      : REFERRAL_PROGRAM_CAP_WARN_PERCENT

  return {
    monthlySpendAlertThb,
    monthlySpendWarnPercent,
    /** @deprecated 80% of early-warning 150k — kept for snapshot compat; UI uses programCapWarnThb */
    monthlySpendWarnThb: round2((monthlySpendAlertThb * monthlySpendWarnPercent) / 100),
    programCapThb,
    programCapWarnPercent: REFERRAL_PROGRAM_CAP_WARN_PERCENT,
    programCapWarnThb: round2((programCapThb * REFERRAL_PROGRAM_CAP_WARN_PERCENT) / 100),
  }
}

/**
 * Independent flags — both may be true at once.
 * @param {number} monthlyEarnedThb
 * @param {ReturnType<typeof deriveReferralSpendAlertThresholds>} thresholds
 */
export function resolveReferralSpendAlertFlags(monthlyEarnedThb, thresholds) {
  const spend = round2(monthlyEarnedThb)
  const early = round2(thresholds?.monthlySpendAlertThb)
  const capWarn = round2(thresholds?.programCapWarnThb)
  return {
    earlyWarningTriggered: early > 0 && spend >= early,
    approachingCapTriggered: capWarn > 0 && spend >= capWarn,
  }
}
