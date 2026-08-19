/**
 * Stage 114.4 / 131.A1.3 — пороги алертов FinTech (из system_settings.general + program cap).
 * Early warning (150k) and 80% of referral_monthly_program_cap_thb are independent (ADR-131A §9.7).
 */
import { PricingService } from '@/lib/services/pricing.service'
import { SystemConfigService } from '@/lib/services/finance/system-config.service.js'
import { FINTECH_CONFIG_DEFAULTS } from '@/lib/config/fintech-config-defaults.js'
import { deriveReferralSpendAlertThresholds } from '@/lib/admin/referral-spend-alert-thresholds.js'

const DEFAULT_LARGE_EARN_THB = 10_000
const DEFAULT_HOURLY_BURST_THB = 25_000
const DEFAULT_MONTHLY_SPEND_THB = 150_000
const DEFAULT_MONTHLY_SPEND_WARN_PERCENT = 80

export async function getReferralAdminAlertPolicy() {
  const [general, fintech] = await Promise.all([
    PricingService.getGeneralPricingSettings(),
    SystemConfigService.getFintechConfig().catch(() => null),
  ])
  const largeRaw = Number(
    general?.referral_admin_large_earn_alert_thb ?? general?.referralAdminLargeEarnAlertThb,
  )
  const burstRaw = Number(
    general?.referral_admin_hourly_burst_alert_thb ?? general?.referralAdminHourlyBurstAlertThb,
  )
  const monthlyRaw = Number(
    general?.referral_admin_monthly_spend_alert_thb ?? general?.referralAdminMonthlySpendAlertThb,
  )
  const warnPctRaw = Number(
    general?.referral_admin_monthly_spend_warn_percent ?? general?.referralAdminMonthlySpendWarnPercent,
  )
  const monthlySpendWarnPercent =
    Number.isFinite(warnPctRaw) && warnPctRaw > 0 && warnPctRaw < 100
      ? Math.round(warnPctRaw * 10) / 10
      : DEFAULT_MONTHLY_SPEND_WARN_PERCENT
  const monthlySpendAlertThb =
    Number.isFinite(monthlyRaw) && monthlyRaw > 0 ? Math.round(monthlyRaw * 100) / 100 : DEFAULT_MONTHLY_SPEND_THB
  const programCapThb = Number(
    fintech?.referralMonthlyProgramCapThb ?? FINTECH_CONFIG_DEFAULTS.referral_monthly_program_cap_thb,
  )
  const spend = deriveReferralSpendAlertThresholds({
    monthlySpendAlertThb,
    programCapThb,
    monthlySpendWarnPercent,
  })
  return {
    largeEarnAlertThb:
      Number.isFinite(largeRaw) && largeRaw > 0 ? Math.round(largeRaw * 100) / 100 : DEFAULT_LARGE_EARN_THB,
    hourlyBurstAlertThb:
      Number.isFinite(burstRaw) && burstRaw > 0 ? Math.round(burstRaw * 100) / 100 : DEFAULT_HOURLY_BURST_THB,
    monthlySpendAlertThb: spend.monthlySpendAlertThb,
    monthlySpendWarnPercent: spend.monthlySpendWarnPercent,
    monthlySpendWarnThb: spend.monthlySpendWarnThb,
    monthlySpendWarnRatio: spend.monthlySpendWarnPercent / 100,
    programCapThb: spend.programCapThb,
    programCapWarnPercent: spend.programCapWarnPercent,
    programCapWarnThb: spend.programCapWarnThb,
  }
}
