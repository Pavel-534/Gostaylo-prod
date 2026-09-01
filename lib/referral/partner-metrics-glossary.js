/**
 * Stage 202.26 — SSOT for partner metric axes (copy-only disambiguation).
 * Does NOT change counters in referral-tier-sync / qualified-host-metrics.
 */

/** @typedef {'l1_invites' | 'withdraw_tier' | 'network_earnings' | 'community_qualified'} PartnerMetricsAxis */

export const PARTNER_METRICS_AXES = Object.freeze({
  L1_INVITES: 'l1_invites',
  WITHDRAW_TIER: 'withdraw_tier',
  NETWORK_EARNINGS: 'network_earnings',
  COMMUNITY_QUALIFIED: 'community_qualified',
})

/**
 * i18n keys for each axis (term + definition + example + optional subtitle).
 * @type {Record<PartnerMetricsAxis, { axis: PartnerMetricsAxis, termKey: string, definitionKey: string, exampleKey: string, subtitleKey: string }>}
 */
export const REFERRAL_GLOSSARY = Object.freeze({
  l1_invites: {
    axis: 'l1_invites',
    termKey: 'referralGlossary_l1Invites_term',
    definitionKey: 'referralGlossary_l1Invites_def',
    exampleKey: 'referralGlossary_l1Invites_example',
    subtitleKey: 'referralGlossary_l1Invites_subtitle',
  },
  withdraw_tier: {
    axis: 'withdraw_tier',
    termKey: 'referralGlossary_withdrawTier_term',
    definitionKey: 'referralGlossary_withdrawTier_def',
    exampleKey: 'referralGlossary_withdrawTier_example',
    subtitleKey: 'referralGlossary_withdrawTier_subtitle',
  },
  network_earnings: {
    axis: 'network_earnings',
    termKey: 'referralGlossary_networkEarnings_term',
    definitionKey: 'referralGlossary_networkEarnings_def',
    exampleKey: 'referralGlossary_networkEarnings_example',
    subtitleKey: 'referralGlossary_networkEarnings_subtitle',
  },
  community_qualified: {
    axis: 'community_qualified',
    termKey: 'referralGlossary_communityQualified_term',
    definitionKey: 'referralGlossary_communityQualified_def',
    exampleKey: 'referralGlossary_communityQualified_example',
    subtitleKey: 'referralGlossary_communityQualified_subtitle',
  },
})

/**
 * @param {string} axis
 * @returns {boolean}
 */
export function isValidPartnerMetricsAxis(axis) {
  return Object.prototype.hasOwnProperty.call(REFERRAL_GLOSSARY, String(axis || ''))
}
