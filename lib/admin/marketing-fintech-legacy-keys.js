/** Client-safe key lists for marketing ↔ fintech SSOT boundary (Stage 202.21). */

/** Keys written to system_settings.general (promo tank + UX knobs only). */
export const MARKETING_GENERAL_ONLY_KEYS = Object.freeze([
  'marketing_promo_pot',
  'marketingPromoPot',
  'promo_boost_per_booking',
  'promoBoostPerBooking',
  'promo_turbo_mode_enabled',
  'promoTurboModeEnabled',
  'organic_to_promo_pot_percent',
  'organicToPromoPotPercent',
  'referral_boost_allocation_rule',
  'referralBoostAllocationRule',
  'payout_to_internal_ratio',
  'payoutToInternalRatio',
  'welcome_bonus_amount',
  'welcomeBonusAmount',
  'referral_monthly_goal_thb',
  'referralMonthlyGoalThb',
  'referral_hold_days',
  'referralHoldDays',
])

/** Legacy general keys that must not be persisted (fintech SSOT). */
export const MARKETING_FINTECH_LEGACY_GENERAL_KEYS = Object.freeze([
  'referral_reinvestment_percent',
  'referralReinvestmentPercent',
  'referral_split_ratio',
  'referralSplitRatio',
  'acquiring_fee_percent',
  'acquiringFeePercent',
  'operational_reserve_percent',
  'operationalReservePercent',
  'partner_activation_bonus',
  'partnerActivationBonus',
  'mlm_level1_percent',
  'mlmLevel1Percent',
  'mlm_level2_percent',
  'mlmLevel2Percent',
])
