/**
 * Stage 114.4 — пороги алертов FinTech (из system_settings.general, без смены экономики).
 */
import { PricingService } from '@/lib/services/pricing.service'

const DEFAULT_LARGE_EARN_THB = 10_000
const DEFAULT_HOURLY_BURST_THB = 25_000
const DEFAULT_MONTHLY_SPEND_THB = 150_000
const DEFAULT_MONTHLY_SPEND_WARN_PERCENT = 80

export async function getReferralAdminAlertPolicy() {
  const general = await PricingService.getGeneralPricingSettings()
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
  return {
    largeEarnAlertThb:
      Number.isFinite(largeRaw) && largeRaw > 0 ? Math.round(largeRaw * 100) / 100 : DEFAULT_LARGE_EARN_THB,
    hourlyBurstAlertThb:
      Number.isFinite(burstRaw) && burstRaw > 0 ? Math.round(burstRaw * 100) / 100 : DEFAULT_HOURLY_BURST_THB,
    monthlySpendAlertThb,
    monthlySpendWarnPercent,
    monthlySpendWarnThb: Math.round(((monthlySpendAlertThb * monthlySpendWarnPercent) / 100) * 100) / 100,
    monthlySpendWarnRatio: monthlySpendWarnPercent / 100,
  }
}
