/**
 * Stage 71.7 — Restore guest wallet credits when cancelling before capture (AWAITING_PAYMENT etc.).
 * Idempotent via `wallet_apply_operation` reference_id.
 */
import WalletService from '@/lib/services/finance/wallet.service';

/** Statuses where checkout wallet spend lives only in booking metadata (no escrow ledger refund path). */
const WALLET_RESTORE_STATUSES = new Set([
  'PENDING',
  'INQUIRY',
  'CONFIRMED',
  'AWAITING_PAYMENT',
  'PAID',
]);

export async function restoreWalletSpendOnBookingCancel(bookingBefore, bookingId) {
  const st = String(bookingBefore?.status || '').toUpperCase();
  if (!WALLET_RESTORE_STATUSES.has(st)) {
    return { restored: false, reason: 'status_not_eligible' };
  }
  const meta =
    bookingBefore?.metadata && typeof bookingBefore.metadata === 'object'
      ? bookingBefore.metadata
      : {};
  const w = Math.max(0, Math.round(Number(meta.wallet_discount_thb || 0)));
  if (w <= 0) return { restored: false, reason: 'no_wallet_discount' };
  const renterId = bookingBefore.renter_id;
  if (!renterId) return { restored: false, reason: 'no_renter' };

  const refId = `booking:${String(bookingId)}:wallet_cancel_refund`;
  const credit = await WalletService.addFunds(
    String(renterId),
    w,
    'booking_cancel_wallet_restore',
    refId,
    {
      trigger: 'booking_cancel',
      previous_status: st,
      booking_id: String(bookingId),
    },
  );
  if (!credit.success && String(credit.error || '').includes('ALREADY_APPLIED')) {
    return { restored: false, reason: 'already_restored', idempotent: true };
  }
  if (!credit.success) {
    return { restored: false, reason: 'credit_failed', error: credit.error };
  }
  await WalletService.restoreWelcomeSliceAfterCancelRefund(String(renterId), w);
  return { restored: true, amountThb: w };
}

export default { restoreWalletSpendOnBookingCancel };
