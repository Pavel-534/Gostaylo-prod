/**
 * Stage 114.1 / 119.1 — backward-compat wrapper; SSOT: referral-lifecycle-hook.
 */
import { runReferralCompletionPayout } from '@/lib/services/marketing/referral-lifecycle-hook.js';

/**
 * @param {string} bookingId
 * @param {{ trigger?: string }} [options]
 */
export async function runReferralPayoutOnBookingCompleted(bookingId, options = {}) {
  return runReferralCompletionPayout(bookingId, options);
}
