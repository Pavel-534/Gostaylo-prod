/**
 * Stage 114.1 — единая точка referral payout при переходе брони в COMPLETED.
 * Вызывать из всех completion-путей (partner PUT, payout-batch settle); не дублировать distribute в legacy payout.
 */
import ReferralPnlService from '@/lib/services/marketing/referral-pnl.service.js';

/**
 * @param {string} bookingId
 * @param {{ trigger?: string }} [options]
 */
export async function runReferralPayoutOnBookingCompleted(bookingId, options = {}) {
  const id = String(bookingId || '').trim();
  if (!id) return { success: false, error: 'BOOKING_ID_REQUIRED' };
  const trigger = String(options?.trigger || 'booking_completed');

  let distribute = null;
  let hostActivation = null;
  try {
    distribute = await ReferralPnlService.distribute(id, { trigger });
    if (distribute?.success !== true && distribute?.error) {
      console.warn('[REFERRAL] distribute failed:', distribute.error);
    }
  } catch (e) {
    console.error('[REFERRAL] distribute', e);
    distribute = { success: false, error: e?.message || String(e) };
  }
  try {
    hostActivation = await ReferralPnlService.distributeHostPartnerActivation(id);
    if (hostActivation?.success !== true && hostActivation?.error) {
      console.warn('[REFERRAL] host activation failed:', hostActivation.error);
    }
  } catch (e) {
    console.error('[REFERRAL] host activation', e);
    hostActivation = { success: false, error: e?.message || String(e) };
  }
  return { success: true, distribute, hostActivation };
}
