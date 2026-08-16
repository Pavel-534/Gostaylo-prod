/**
 * Resend transport + text→HTML for NotificationService fallbacks.
 * (Не путать с `lib/services/email.service.js` — брендированные шаблоны React/Resend.)
 * Ошибка Resend изолирована: не влияет на Telegram/FCM в вызывающем коде.
 * Stage 2.2
 */

import { getTransactionalFromAddress } from '@/lib/email-env';
import { buildPremiumHtmlFromPlainText } from '@/lib/email/simple-transactional-email.js';
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js';
import {
  mockResendDeliveryResult,
  shouldMockResendDelivery,
} from '@/lib/email/resend-transport-guard.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;

/**
 * @returns {Promise<{ success: boolean, id?: string, mock?: boolean, error?: string }>}
 */
export async function sendResendEmail(to, subject, textBody, htmlBody = null) {
  if (!RESEND_API_KEY) {
    console.log(`[EMAIL MOCK] To: ${to}, Subject: ${subject}`);
    return { success: true, mock: true };
  }

  if (shouldMockResendDelivery(to)) {
    return mockResendDeliveryResult(to, subject, 'notifications_transport_guard');
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: getTransactionalFromAddress(),
        to: Array.isArray(to) ? to : [to],
        subject,
        text: textBody,
        html: htmlBody || textToHtml(textBody, { subject }),
      }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`[EMAIL SENT] To: ${to}, ID: ${data.id}`);
      return { success: true, id: data.id };
    }
    const error = await response.text();
    console.error(`[EMAIL ERROR] ${error}`);
    const toHint = Array.isArray(to) ? to.join(', ') : String(to);
    void notifySystemAlert(
      `📧 <b>Resend: ошибка HTTP</b> (NotificationService)\n` +
        `subject: <code>${escapeSystemAlertHtml(subject)}</code>\n` +
        `to: <code>${escapeSystemAlertHtml(toHint.slice(0, 120))}</code>\n` +
        `<code>${escapeSystemAlertHtml(error.slice(0, 800))}</code>`,
    );
    return { success: false, error };
  } catch (error) {
    console.error(`[EMAIL ERROR] ${error.message}`);
    const toHint = Array.isArray(to) ? to.join(', ') : String(to);
    void notifySystemAlert(
      `📧 <b>Resend: исключение при отправке</b> (NotificationService)\n` +
        `subject: <code>${escapeSystemAlertHtml(subject)}</code>\n` +
        `to: <code>${escapeSystemAlertHtml(toHint.slice(0, 120))}</code>\n` +
        `<code>${escapeSystemAlertHtml(error?.message || error)}</code>`,
    );
    return { success: false, error: error.message };
  }
}

/**
 * Plain notification body → premium chrome (logo lockup SSOT).
 * Stage 201.69 — closes the remaining branded-email queue at the transport layer.
 * Stage 200.74 — content still escaped (no raw HTML injection from names/notes).
 *
 * @param {string} text
 * @param {{ subject?: string }} [opts]
 */
export function textToHtml(text, opts = {}) {
  return buildPremiumHtmlFromPlainText(opts.subject || '', text)
}
