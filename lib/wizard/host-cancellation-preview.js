/**
 * Stage 156.3 — host-facing cancellation scenarios (inverse of guest refund SSOT).
 * Guest rules: lib/cancellation-refund-rules.js + listings-public listingCancellation_*.
 */
import { normalizeCancellationPolicy } from '@/lib/cancellation-refund-rules'

/**
 * @typedef {{ timingKey: string, hostKeepPercent: number }} HostCancelScenario
 */

/** @type {Record<'flexible'|'moderate'|'strict', HostCancelScenario[]>} */
const HOST_SCENARIOS = Object.freeze({
  flexible: [
    { timingKey: 'wizardCancelPreview_timing_flexible_early', hostKeepPercent: 0 },
    { timingKey: 'wizardCancelPreview_timing_flexible_late', hostKeepPercent: 50 },
  ],
  moderate: [
    { timingKey: 'wizardCancelPreview_timing_moderate_early', hostKeepPercent: 0 },
    { timingKey: 'wizardCancelPreview_timing_moderate_mid', hostKeepPercent: 50 },
    { timingKey: 'wizardCancelPreview_timing_moderate_late', hostKeepPercent: 100 },
  ],
  strict: [
    { timingKey: 'wizardCancelPreview_timing_strict_early', hostKeepPercent: 50 },
    { timingKey: 'wizardCancelPreview_timing_strict_late', hostKeepPercent: 100 },
  ],
})

/**
 * @param {string | null | undefined} policyRaw
 * @returns {HostCancelScenario[]}
 */
export function getHostCancellationScenarios(policyRaw) {
  const policy = normalizeCancellationPolicy(policyRaw)
  return HOST_SCENARIOS[policy] || HOST_SCENARIOS.moderate
}

/**
 * @param {string | null | undefined} policyRaw
 * @returns {'flexible'|'moderate'|'strict'}
 */
export function getNormalizedWizardCancellationPolicy(policyRaw) {
  return normalizeCancellationPolicy(policyRaw)
}
