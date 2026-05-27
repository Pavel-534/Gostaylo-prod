/**
 * Stage 119.3 — structured telemetry for referral clawback / promo tank reversal.
 */
import { logStructured } from '@/lib/critical-telemetry.js'

/**
 * @param {'clawback' | 'promo_tank_reversal'} operation
 * @param {Record<string, unknown>} payload
 */
export function logReferralFinancialOperation(operation, payload = {}) {
  logStructured({
    module: 'referral-financial',
    stage: operation,
    ...payload,
  })
}
