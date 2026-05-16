/**
 * @typedef {Object} PricingProfileRow
 * @property {string} id
 * @property {string} name
 * @property {number} guest_fee_pct
 * @property {number} host_fee_pct
 * @property {number} fx_markup_pct
 * @property {number} ru_agent_share_pct
 * @property {number} kr_service_share_pct
 * @property {number} insurance_fund_pct
 * @property {number} tax_rate_pct
 */

/**
 * @typedef {Object} PricingProfileResolution
 * @property {PricingProfileRow} profile
 * @property {string[]} resolution_trace — e.g. ['listing:pp-…', 'profile:…', 'regional:TH', 'default:pp-global-default']
 */

/**
 * Guest-facing total in charge currency (Brutto). No internal RU/KG split.
 * @typedef {Object} GuestBrutto
 * @property {number} amount
 * @property {string} currency
 */

/**
 * Immutable financial breakdown for booking snapshot v2.
 * Fields ru_fee_thb / kr_fee_thb / fx_markup_thb are **admin/compliance only** — never expose to partner/guest APIs.
 *
 * @typedef {Object} FinalBreakdown
 * @property {string} pricing_profile_id
 * @property {string[]} resolution_trace
 * @property {number} subtotal_thb
 * @property {number} guest_service_fee_thb
 * @property {number} host_commission_thb
 * @property {number} tax_amount_thb
 * @property {number} insurance_reserve_thb
 * @property {number} platform_margin_pool_thb — guest_service + host_commission − insurance
 * @property {number} ru_fee_thb — internal (% of subtotal)
 * @property {number} kr_fee_thb — internal (% of subtotal)
 * @property {number} fx_markup_thb — internal FX spread in THB equivalent
 * @property {number} total_guest_payable_thb — before pot rounding
 * @property {number} total_guest_payable_rounded_thb — after pot (Brutto THB anchor)
 * @property {number} rounding_pot_thb — remainder from Math.round(guest payable); platform revenue
 * @property {number} [rounding_diff_pot_thb] — alias for bookings.rounding_diff_pot column
 * @property {number} total_partner_netto_thb — Netto for partner UI
 * @property {GuestBrutto} [total_guest_brutto]
 * @property {number} [fx_raw_rate_to_thb]
 * @property {number} [fx_customer_rate_to_thb]
 * @property {number} [fx_markup_pct_applied]
 */

/**
 * @typedef {Object} ComputeFinalBreakdownInput
 * @property {number} subtotal_thb — after duration/promo discounts
 * @property {PricingProfileRow} profile — resolved pricing profile (SSOT percents)
 * @property {string} [payment_currency='THB']
 * @property {string} [listing_base_currency='THB']
 * @property {Record<string, number>} [raw_fx_rate_map] — THB per 1 unit; from getRawRateMap
 * @property {string[]} [resolution_trace]
 */

export {}
