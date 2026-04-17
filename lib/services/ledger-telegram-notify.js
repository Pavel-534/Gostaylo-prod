/**
 * Telegram FINANCE topic when ledger posts guest clearing (money recognized).
 */

import { sendToTopic } from '@/lib/telegram'
import { getPublicSiteUrl } from '@/lib/site-url.js'

const APP_URL = getPublicSiteUrl()

/**
 * Fire-and-forget: DEBIT on GUEST_PAYMENT_CLEARING / la-sys-guest-clearing after successful ledger insert.
 * @param {{ bookingId: string, guestTotalThb: number, journalId: string }} p
 */
export function notifyLedgerGuestPaymentClearingPosted(p) {
  const { bookingId, guestTotalThb, journalId } = p
  const text = [
    '📒 <b>Ledger · приход (GUEST_PAYMENT_CLEARING)</b>',
    '',
    `Бронь: <code>${bookingId}</code>`,
    `Сумма гостя (DEBIT clearing): <b>${guestTotalThb}</b> THB`,
    `Журнал: <code>${journalId}</code>`,
    '',
    `<a href="${APP_URL}/admin/financial-health">Financial health →</a>`,
  ].join('\n')

  void sendToTopic('FINANCE', text).catch((e) => {
    console.warn('[ledger-telegram-notify] failed:', e?.message || e)
  })
}
