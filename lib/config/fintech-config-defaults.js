/**
 * Stage 131.0 — bootstrap defaults for `system_fintech_settings` (Ambassador 3.0 launch preset).
 * Runtime SSOT: DB row `system_fintech_settings.id = 'global'` via SystemConfigService.
 * These values apply only when the row is missing or a column is null.
 */

/** @type {const} */
export const FINTECH_CONFIG_DEFAULTS = Object.freeze({
  id: 'global',

  // Owner waterfall (%)
  acquiring_fee_percent: 4.3,
  usn_provision_percent: 6,
  vat_provision_percent: 5,
  reserve_bank_percent: 0.5,
  operational_reserve_percent: 0,
  safety_lock_max_share: 0.95,

  // Referral pool
  referral_reinvestment_percent: 45,
  referral_split_ratio: 0.5,

  // Guest L2 live ledger (default on; set false in DB for shadow-only)
  ambassador_guest_l2_enabled: true,
  // Guest pool split — owner canon post cutover 2026-08-19 (ADR-131A).
  ambassador_guest_pool_l1_percent: 42,
  ambassador_guest_pool_l2_percent: 10,
  ambassador_guest_pool_l3_percent: 5,
  ambassador_guest_pool_referee_percent: 43,
  ambassador_guest_l2_max_thb_per_booking: 500,
  ambassador_guest_l2_max_thb_per_month: 50_000,
  ambassador_guest_l3_enabled: true,
  ambassador_guest_l3_min_direct_partners: 10,
  ambassador_guest_l3_max_thb_per_booking: 500,
  ambassador_guest_l3_max_thb_per_month: 20_000,

  /**
   * Program cap (sum guest_booking referral_ledger per UTC month; defer if exceeded).
   * Owner canon 1M THB post cutover 2026-08-19. Existing DB rows win over bootstrap defaults.
   */
  referral_monthly_program_cap_thb: 1_000_000,
  referral_withdrawal_fee_percent: 1.5,

  // Supply Builder (host activation)
  mlm_level1_percent: 70,
  mlm_level2_percent: 30,
  partner_activation_bonus_thb: 500,

  // Feature flags
  ambassador_3_waterfall_enabled: true,
  ambassador_3_program_cap_enabled: true,
})

/** CamelCase mirrors for JS `??` fallbacks (same numbers as snake keys above). */
export const FINTECH_JS_DEFAULTS = Object.freeze({
  referralReinvestmentPercent: FINTECH_CONFIG_DEFAULTS.referral_reinvestment_percent,
  referralSplitRatio: FINTECH_CONFIG_DEFAULTS.referral_split_ratio,
  ambassadorGuestL2Enabled: FINTECH_CONFIG_DEFAULTS.ambassador_guest_l2_enabled,
  ambassadorGuestPoolL1Percent: FINTECH_CONFIG_DEFAULTS.ambassador_guest_pool_l1_percent,
  ambassadorGuestPoolL2Percent: FINTECH_CONFIG_DEFAULTS.ambassador_guest_pool_l2_percent,
  ambassadorGuestPoolL3Percent: FINTECH_CONFIG_DEFAULTS.ambassador_guest_pool_l3_percent,
  ambassadorGuestPoolRefereePercent: FINTECH_CONFIG_DEFAULTS.ambassador_guest_pool_referee_percent,
  ambassadorGuestL2MaxThbPerBooking: FINTECH_CONFIG_DEFAULTS.ambassador_guest_l2_max_thb_per_booking,
  ambassadorGuestL2MaxThbPerMonth: FINTECH_CONFIG_DEFAULTS.ambassador_guest_l2_max_thb_per_month,
  ambassadorGuestL3Enabled: FINTECH_CONFIG_DEFAULTS.ambassador_guest_l3_enabled,
  ambassadorGuestL3MinDirectPartners: FINTECH_CONFIG_DEFAULTS.ambassador_guest_l3_min_direct_partners,
  ambassadorGuestL3MaxThbPerBooking: FINTECH_CONFIG_DEFAULTS.ambassador_guest_l3_max_thb_per_booking,
  ambassadorGuestL3MaxThbPerMonth: FINTECH_CONFIG_DEFAULTS.ambassador_guest_l3_max_thb_per_month,
  referralMonthlyProgramCapThb: FINTECH_CONFIG_DEFAULTS.referral_monthly_program_cap_thb,
  referralWithdrawalFeePercent: FINTECH_CONFIG_DEFAULTS.referral_withdrawal_fee_percent,
  mlmLevel1Percent: FINTECH_CONFIG_DEFAULTS.mlm_level1_percent,
  mlmLevel2Percent: FINTECH_CONFIG_DEFAULTS.mlm_level2_percent,
  partnerActivationBonusThb: FINTECH_CONFIG_DEFAULTS.partner_activation_bonus_thb,
})

export default FINTECH_CONFIG_DEFAULTS
