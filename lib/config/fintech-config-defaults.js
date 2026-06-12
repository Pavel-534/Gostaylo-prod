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

  // Guest L2 (P1 — flag off at launch)
  ambassador_guest_l2_enabled: true,
  ambassador_guest_pool_l1_percent: 45,
  ambassador_guest_pool_l2_percent: 12,
  ambassador_guest_pool_referee_percent: 43,
  ambassador_guest_l2_max_thb_per_booking: 500,
  ambassador_guest_l2_max_thb_per_month: 50_000,

  // Caps & withdrawal
  referral_monthly_program_cap_thb: 250_000,
  referral_withdrawal_fee_percent: 1.5,

  // Supply Builder (host activation)
  mlm_level1_percent: 70,
  mlm_level2_percent: 30,
  partner_activation_bonus_thb: 500,

  // Feature flags
  ambassador_3_waterfall_enabled: true,
  ambassador_3_program_cap_enabled: true,
})

export default FINTECH_CONFIG_DEFAULTS
